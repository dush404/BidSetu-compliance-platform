"""
Full verification pipeline for a single bidder.
Orchestrates: data fetch → rule engine → score → AI text → save.
"""
import json
import asyncio
from datetime import datetime, timezone
from typing import Any

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
) -> tuple[str, int]:
    """
    Use LLM to generate a human-readable summary.
    Falls back to template-based text if model unavailable.
    Returns (summary_text, confidence_pct).
    """
    if model is None:
        # Template fallback — no LLM
        fail_checks = [k for k, v in checks.items() if v.get("status") == "FAIL"]
        review_checks = [k for k, v in checks.items() if v.get("status") == "REVIEW"]
        pass_checks = [k for k, v in checks.items() if v.get("status") == "PASS"]

        if recommendation == "QUALIFY":
            text = (
                f"All mandatory compliance requirements for {company_name} are satisfied. "
                f"Passed {len(pass_checks)} checks with a compliance score of {score}/100."
            )
        elif recommendation == "MANUAL_REVIEW":
            issues = ", ".join(review_checks + fail_checks)
            text = (
                f"{company_name} has passed most checks ({len(pass_checks)} passed) "
                f"but requires review for: {issues}. Compliance score: {score}/100."
            )
        else:
            issues = ", ".join(fail_checks)
            text = (
                f"Disqualification recommended for {company_name}. "
                f"Critical failures in: {issues}. Compliance score: {score}/100. "
                f"Risk level: {risk}."
            )
        confidence = min(95, score + 10) if recommendation == "QUALIFY" else max(60, 100 - score)
        return text, confidence

    # LLM path — used only for text, rule_engine decides compliance
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

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        confidence = min(95, score + 10)
        return text, confidence
    except Exception as exc:
        print(f"AI summary generation failed: {exc}")
        return _generate_ai_summary(company_name, score, risk, recommendation, checks, model=None)


def run_verification(bidder_id: str | int, model=None) -> dict[str, Any]:
    """
    Main verification pipeline. Returns structured result dict.
    """
    verified_at = datetime.now(timezone.utc).isoformat()

    # 1. Fetch bidder from Strapi
    bidder = get_bidder(bidder_id)
    if not bidder:
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

    # 2. Query simulated government databases
    try:
        gst_record = fetch_gst_status(gstin)
        pan_record = fetch_pan_data(pan)
        udyam_record = fetch_udyam_data(udyam_id)
        epfo_record = fetch_epfo_data(epfo_code)
        esic_record = fetch_esic_data(esic_code)
        startup_record = fetch_startup_data(dpiit_number)
        nsic_record = fetch_nsic_data(nsic_number)
        blacklist_record = check_blacklist(gstin, pan, company_name)
    except StrapiClientError as exc:
        return {
            "error": f"Database query failed: {exc}",
            "bidderId": str(bidder_id),
            "overallScore": 0,
            "riskLevel": "Critical",
            "recommendation": "MANUAL_REVIEW",
        }

    # 3. Apply deterministic rules
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
    ai_summary, confidence = _generate_ai_summary(company_name, score, risk, recommendation, checks, model)

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
        "confidence": confidence,
        "verifiedAt": verified_at,
        "verificationMode": "SIMULATED_GOV_DATABASE",
    }

    # 8. Save to Strapi
    try:
        save_verification_result(bidder_id, result)
        create_verification_log(bidder_id, f"Verification complete — {recommendation}", result)
    except StrapiClientError as exc:
        # A verification is not complete until its result and audit event are persisted.
        raise StrapiClientError(f"Verification calculated but could not be saved: {exc}") from exc

    return result


async def run_verification_async(bidder_id: int, semaphore: asyncio.Semaphore, model=None) -> dict[str, Any]:
    """Async wrapper for concurrent batch verification with rate limiting."""
    async with semaphore:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, run_verification, bidder_id, model)
