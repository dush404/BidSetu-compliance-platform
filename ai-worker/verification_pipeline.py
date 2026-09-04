"""
Full verification pipeline for a single bidder.
Orchestrates: data fetch → rule engine → score → AI text → save.
"""
import json
import asyncio
from datetime import datetime, timezone
from typing import Any
import requests

from strapi_client import (
    get_bidder,
    fetch_gst_status,
    fetch_udyam_data,
    fetch_pan_data,
    fetch_epfo_data,
    fetch_esic_data,
    fetch_startup_data,
    fetch_nsic_data,
    check_blacklist,
    save_verification_result,
    create_verification_log,
    StrapiClientError,
)
from rule_engine import (
    check_gst,
    check_pan,
    check_udyam,
    check_epfo,
    check_esic,
    check_startup_india,
    check_nsic,
    check_blacklist_rule,
    calculate_score,
    determine_recommendation,
)


def _generate_ai_summary(
    company_name: str,
    score: int,
    risk: str,
    recommendation: str,
    checks: dict,
    model=None,
    ai_provider: str = "auto",
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "qwen3:14b",
    log_fn=None,
) -> tuple[str, int, str]:
    """
    Use LLM (Ollama or Gemini) to generate a human-readable summary.
    Falls back to template-based text if models are unavailable.
    Returns (summary_text, confidence_pct, source_label).
    """
    prompt = f"""You are an AI assistant for a government procurement officer.
Write a brief, professional 2-3 sentence summary of this bidder verification result.
DO NOT make any legal judgement — only summarise the facts.

Company: {company_name}
Compliance Score: {score}/100
Risk Level: {risk}
Recommendation (determined by rule engine, not AI): {recommendation}
Checks:
{json.dumps({k: v.get("status") for k, v in checks.items()}, indent=2)}

Write the summary in plain English. Do not use markdown."""

    confidence = min(95, score + 10) if recommendation == "QUALIFY" else max(60, 100 - score)

    # Helper: try Ollama
    def try_ollama() -> str | None:
        try:
            import re
            if log_fn:
                log_fn("AI:OLLAMA", f"Calling Ollama ({ollama_model}) for {company_name}…")
            payload = {"model": ollama_model, "prompt": prompt, "stream": False}
            resp = requests.post(
                f"{ollama_url.rstrip('/')}/api/generate",
                json=payload,
                timeout=120,
            )
            # If Ollama encountered a CUDA memory/buffer overrun, retry with CPU mode
            if resp.status_code != 200:
                err_body = resp.text.lower()
                if "cuda" in err_body or "buffer" in err_body or "terminated" in err_body or "exit status" in err_body:
                    if log_fn:
                        log_fn("AI:OLLAMA", f"GPU error detected — retrying {ollama_model} in CPU mode", level="WARN")
                    print(f"Ollama GPU error detected. Retrying {ollama_model} with CPU execution (num_gpu=0)...")
                    payload["options"] = {"num_gpu": 0}
                    resp = requests.post(
                        f"{ollama_url.rstrip('/')}/api/generate",
                        json=payload,
                        timeout=180,
                    )

            if resp.status_code == 200:
                raw_text = resp.json().get("response", "").strip()
                # Remove thinking tags from qwen3/thinking models if present
                clean = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
                if clean:
                    if log_fn:
                        log_fn("AI:OLLAMA", f"Ollama ({ollama_model}) generated summary OK", data={"chars": len(clean)})
                    return clean
            else:
                if log_fn:
                    log_fn("AI:OLLAMA", f"Ollama returned {resp.status_code}", level="ERROR", data={"body": resp.text[:200]})
                print(f"Ollama returned {resp.status_code}: {resp.text}")
        except Exception as exc:
            if log_fn:
                log_fn("AI:OLLAMA", f"Ollama call failed: {exc}", level="ERROR")
            print(f"Ollama ({ollama_model}) generation failed: {exc}")
        return None

    # Helper: try Gemini
    def try_gemini() -> str | None:
        if not model:
            return None
        try:
            if log_fn:
                log_fn("AI:GEMINI", f"Calling Gemini for {company_name}…")
            res = model.generate_content(prompt)
            text = res.text.strip()
            if log_fn:
                log_fn("AI:GEMINI", "Gemini generated summary OK", data={"chars": len(text)})
            return text
        except Exception as exc:
            if log_fn:
                log_fn("AI:GEMINI", f"Gemini call failed: {exc}", level="ERROR")
            print(f"Gemini generation failed: {exc}")
            return None

    # 1. Execute according to configured provider
    if ai_provider == "ollama":
        text = try_ollama()
        if text:
            return text, confidence, f"Ollama ({ollama_model})"
        if model:
            text = try_gemini()
            if text:
                return text, confidence, "Gemini (Fallback)"

    elif ai_provider == "gemini":
        if model:
            text = try_gemini()
            if text:
                return text, confidence, "Gemini"
        text = try_ollama()
        if text:
            return text, confidence, f"Ollama ({ollama_model})"

    else:  # "auto"
        # If Gemini key is not configured, prioritize Ollama
        if not model:
            text = try_ollama()
            if text:
                return text, confidence, f"Ollama ({ollama_model})"
        else:
            text = try_gemini() or try_ollama()
            if text:
                source = "Gemini" if model else f"Ollama ({ollama_model})"
                return text, confidence, source

    # 2. Template fallback if LLMs fail or not configured
    fail_checks = [k for k, v in checks.items() if v.get("status") == "FAIL"]
    review_checks = [k for k, v in checks.items() if v.get("status") == "REVIEW"]
    pass_checks = [k for k, v in checks.items() if v.get("status") == "PASS"]

    if recommendation == "QUALIFY":
        tmpl = (
            f"All mandatory compliance requirements for {company_name} are satisfied. "
            f"Passed {len(pass_checks)} checks with a compliance score of {score}/100."
        )
    elif recommendation == "MANUAL_REVIEW":
        issues = ", ".join(review_checks + fail_checks)
        tmpl = (
            f"{company_name} has passed most checks ({len(pass_checks)} passed) "
            f"but requires review for: {issues}. Compliance score: {score}/100."
        )
    else:
        issues = ", ".join(fail_checks)
        tmpl = (
            f"Disqualification recommended for {company_name}. "
            f"Critical failures in: {issues}. Compliance score: {score}/100. "
            f"Risk level: {risk}."
        )
    return tmpl, confidence, "Rule Engine"


def run_verification(
    bidder_id: str | int,
    model=None,
    ai_provider: str = "auto",
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "qwen3:14b",
    log_fn=None,
) -> dict[str, Any]:
    """
    Main verification pipeline. Returns structured result dict.
    log_fn(stage, msg, level?, data?) — optional structured log emitter.
    """
    def log(stage: str, msg: str, level: str = "INFO", data: dict | None = None):
        if log_fn:
            log_fn(stage, msg, level=level, data=data)

    verified_at = datetime.now(timezone.utc).isoformat()

    # 1. Fetch bidder from Strapi
    log("FETCH", f"Fetching bidder {bidder_id} from Strapi…")
    bidder = get_bidder(bidder_id)
    if not bidder:
        log("FETCH", f"Bidder {bidder_id} not found in Strapi", level="ERROR")
        return {
            "error": f"Bidder {bidder_id} not found",
            "bidderId": str(bidder_id),
            "overallScore": 0,
            "riskLevel": "Critical",
            "recommendation": "DISQUALIFY",
        }

    company_name = bidder.get("companyName") or bidder.get("bidderName") or "Unknown"
    gstin = bidder.get("gstin")
    pan = bidder.get("panNumber")
    udyam_id = bidder.get("udyamId")
    epfo_code = bidder.get("epfoCode")
    esic_code = bidder.get("esicCode")
    dpiit_number = bidder.get("dpiitNumber")
    nsic_number = bidder.get("nsicNumber")
    log("FETCH", f"Fetched bidder: {company_name}", data={"gstin": gstin, "pan": pan})

    # 2. Query simulated government databases
    try:
        log("DB:GST", f"Querying GST database for {gstin}…")
        gst_record = fetch_gst_status(gstin)
        log("DB:GST", f"GST status: {(gst_record or {}).get('status', 'Not Found')}")

        log("DB:PAN", f"Querying PAN database for {pan}…")
        pan_record = fetch_pan_data(pan)
        log("DB:PAN", f"PAN record: {'Found' if pan_record else 'Not Found'}")

        log("DB:UDYAM", f"Querying Udyam/MSME for {udyam_id}…")
        udyam_record = fetch_udyam_data(udyam_id)
        log("DB:UDYAM", f"Udyam: {'Found' if udyam_record else 'Not Found'}")

        log("DB:EPFO", f"Querying EPFO for {epfo_code}…")
        epfo_record = fetch_epfo_data(epfo_code)
        log("DB:EPFO", f"EPFO: {'Found' if epfo_record else 'Not Found'}")

        log("DB:ESIC", f"Querying ESIC for {esic_code}…")
        esic_record = fetch_esic_data(esic_code)
        log("DB:ESIC", f"ESIC: {'Found' if esic_record else 'Not Found'}")

        log("DB:STARTUP", f"Querying Startup India (DPIIT) for {dpiit_number}…")
        startup_record = fetch_startup_data(dpiit_number)
        log("DB:STARTUP", f"Startup India: {'Found' if startup_record else 'Not Found'}")

        log("DB:NSIC", f"Querying NSIC for {nsic_number}…")
        nsic_record = fetch_nsic_data(nsic_number)
        log("DB:NSIC", f"NSIC: {'Found' if nsic_record else 'Not Found'}")

        log("DB:BLACKLIST", f"Checking Blacklist/Debarment for {company_name}…")
        blacklist_record = check_blacklist(gstin, pan, company_name)
        log(
            "DB:BLACKLIST",
            "BLACKLISTED" if blacklist_record else "Not on blacklist",
            level="ERROR" if blacklist_record else "INFO",
        )
    except StrapiClientError as exc:
        log("DB:ERROR", f"Database query failed: {exc}", level="ERROR")
        return {
            "error": f"Database query failed: {exc}",
            "bidderId": str(bidder_id),
            "overallScore": 0,
            "riskLevel": "Critical",
            "recommendation": "MANUAL_REVIEW",
        }

    # 3. Apply deterministic rules
    log("RULES", f"Running rule engine checks for {company_name}…")
    checks = {
        "gst": check_gst(gstin, gst_record, company_name),
        "pan": check_pan(pan, pan_record, company_name),
        "udyam": check_udyam(udyam_id, udyam_record),
        "epfo": check_epfo(epfo_code, epfo_record),
        "esic": check_esic(esic_code, esic_record),
        "startupIndia": check_startup_india(dpiit_number, startup_record),
        "nsic": check_nsic(nsic_number, nsic_record),
        "blacklist": check_blacklist_rule(blacklist_record),
    }

    # Add timestamp to each check
    for check in checks.values():
        check["checkedAt"] = verified_at

    # 4. Calculate score and risk
    score, risk = calculate_score(checks)
    recommendation = determine_recommendation(score, risk, checks)

    fail_count = sum(1 for c in checks.values() if c.get("status") == "FAIL")
    pass_count = sum(1 for c in checks.values() if c.get("status") == "PASS")
    log(
        "RULES",
        f"Rule engine complete — score: {score}/100, risk: {risk}, recommendation: {recommendation}",
        level="WARN" if recommendation != "QUALIFY" else "INFO",
        data={"score": score, "risk": risk, "recommendation": recommendation, "passed": pass_count, "failed": fail_count},
    )

    # 5. Build discrepancies list
    discrepancies = []
    for key, check in checks.items():
        if check.get("status") in ("FAIL", "REVIEW"):
            submitted = check.get("submitted", {})
            verified = check.get("verified", {})
            for field in set(list(submitted.keys()) + list(verified.keys())):
                sub_val = str(submitted.get(field, ""))
                ver_val = str(verified.get(field, ""))
                if sub_val and ver_val and sub_val != ver_val and field != "blacklisted":
                    discrepancies.append({
                        "field": f"{key}.{field}",
                        "submitted": sub_val,
                        "verified": ver_val,
                        "severity": check.get("severity", "MEDIUM"),
                    })

    # 6. Generate AI explanation (text only — not compliance decision)
    log("AI", f"Generating AI summary (provider: {ai_provider})…")
    ai_summary, confidence, ai_source = _generate_ai_summary(
        company_name, score, risk, recommendation, checks,
        model=model,
        ai_provider=ai_provider,
        ollama_url=ollama_url,
        ollama_model=ollama_model,
        log_fn=log_fn,
    )
    log("AI", f"AI summary complete — source: {ai_source}", data={"source": ai_source, "confidence": confidence})

    # 7. Build final result
    result = {
        "bidderId": str(bidder_id),
        "companyName": company_name,
        "overallScore": score,
        "riskLevel": risk,
        "recommendation": recommendation,
        "checks": checks,
        "discrepancies": discrepancies,
        "evidence": [],
        "aiSummary": ai_summary,
        "aiSource": ai_source,
        "confidence": confidence,
        "verifiedAt": verified_at,
        "verificationMode": "SIMULATED_GOV_DATABASE",
    }

    # 8. Save to Strapi
    log("SAVE", f"Saving verification result for {company_name} to Strapi…")
    try:
        save_verification_result(bidder_id, result)
        create_verification_log(bidder_id, f"Verification complete — {recommendation}", result)
        log("DONE", f"Verification complete for {company_name} — {recommendation} (score: {score}/100)",
            data={"bidderId": str(bidder_id), "score": score, "recommendation": recommendation, "aiSource": ai_source})
    except StrapiClientError as exc:
        # A verification is not complete until its result and audit event are persisted.
        log("SAVE", f"Save failed: {exc}", level="ERROR")
        raise StrapiClientError(f"Verification calculated but could not be saved: {exc}") from exc

    return result


async def run_verification_async(
    bidder_id: int,
    semaphore: asyncio.Semaphore,
    model=None,
    log_fn=None,
) -> dict[str, Any]:
    """Async wrapper for concurrent batch verification with rate limiting."""
    async with semaphore:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, run_verification, bidder_id, model, "auto",
                                          "http://localhost:11434", "qwen3:14b", log_fn)

