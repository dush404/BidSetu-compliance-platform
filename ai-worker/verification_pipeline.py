"""
Full verification pipeline for a single bidder — DOCUMENT-FIRST and LOCAL-AI ONLY.
Orchestrates:
  Fetch documents from Strapi
      ↓
  Extract document text via PyMuPDF
      ↓
  Structured extraction via Local Qwen (Ollama)
      ↓
  Simulated registry checks (GST, PAN, Udyam, EPFO, ESIC, DPIIT, NSIC, Blacklist)
      ↓
  Deterministic Rule Engine (Score + Risk + Recommendation)
      ↓
  Explanatory AI summary via Local Qwen
      ↓
  Persist result and verification logs to Strapi
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import requests

from strapi_client import (
    STRAPI_URL,
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
from document_extractor import process_bidder_documents


def _generate_ai_summary_local_qwen(
    company_name: str,
    score: int,
    risk: str,
    recommendation: str,
    checks: dict,
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "qwen2.5:7b",
    log_fn=None,
) -> tuple[str, int, str]:
    """
    Use local Qwen via Ollama to generate an explanatory, fact-based summary.
    Does not decide compliance — only summarizes the verified structured facts.
    """
    prompt = f"""You are a compliance assistant for a government procurement officer.
Write a concise, professional 2-3 sentence summary of this bidder verification result.
DO NOT decide eligibility — the rule engine has already decided the recommendation: {recommendation}.
Base your text ONLY on the verified facts below.

Company: {company_name}
Compliance Score: {score}/100
Risk Level: {risk}
Deterministic Recommendation: {recommendation}
Registry Checks:
{json.dumps({k: v.get("status") for k, v in checks.items()}, indent=2)}

Write in clear plain text without markdown formatting or bullet points."""

    confidence = min(98, score + 5) if recommendation == "QUALIFY" else max(60, 100 - score)

    try:
        import re
        if log_fn:
            log_fn("AI:SUMMARY", f"Generating explanatory summary via Local Qwen ({ollama_model})…")

        payload = {
            "model": ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2},
        }
        resp = requests.post(
            f"{ollama_url.rstrip('/')}/api/generate",
            json=payload,
            timeout=60,
        )

        if resp.status_code == 200:
            raw_text = resp.json().get("response", "").strip()
            clean = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
            clean = re.sub(r"^```[a-z]*\s*", "", clean)
            clean = re.sub(r"\s*```$", "", clean)
            if clean:
                if log_fn:
                    log_fn("AI:SUMMARY", f"Local Qwen generated verification explanation OK", data={"chars": len(clean)})
                return clean, confidence, f"Ollama ({ollama_model})"
    except Exception as exc:
        if log_fn:
            log_fn("AI:SUMMARY", f"Local Qwen summary unavailable: {exc}", level="WARN")
        print(f"[Ollama Summary] Exception: {exc}")

    # Deterministic fallback summary if Ollama is not active
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
            f"{company_name} scored {score}/100 and requires officer review due to "
            f"the following items: {issues}."
        )
    else:
        tmpl = (
            f"{company_name} received a score of {score}/100 and is flagged as {risk} risk. "
            f"Mandatory statutory check failure(s): {', '.join(fail_checks) or 'Critical failure'}."
        )

    return tmpl, confidence, "Deterministic Rule Summary"


DEFAULT_OLLAMA_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434").rstrip("/")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")


def run_verification(
    bidder_id: str | int,
    ollama_url: str | None = None,
    ollama_model: str | None = None,
    log_fn=None,
    **kwargs,
) -> dict[str, Any]:
    """
    Execute the document-first, local-AI only compliance verification pipeline.
    """
    ollama_url = (ollama_url or DEFAULT_OLLAMA_URL).rstrip("/")
    ollama_model = ollama_model or DEFAULT_OLLAMA_MODEL
    def log(stage: str, msg: str, level: str = "INFO", data: dict | None = None):
        if log_fn:
            log_fn(stage, msg, level=level, data=data)

    verified_at = datetime.now(timezone.utc).isoformat()

    # 1. Fetch bidder and document references from Strapi
    log("FETCH", f"Fetching bidder application {bidder_id} from Strapi…")
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

    raw_docs = bidder.get("documents") or []
    # Handle Strapi v4/v5 media envelope formats
    if isinstance(raw_docs, dict) and "data" in raw_docs:
        raw_docs = raw_docs["data"] or []

    documents: List[Dict[str, Any]] = []
    for d in raw_docs:
        if isinstance(d, dict):
            attrs = d.get("attributes", d)
            attrs["id"] = d.get("id") or attrs.get("id")
            attrs["documentId"] = d.get("documentId") or attrs.get("documentId")
            documents.append(attrs)

    log("DOCUMENT_RECEIVED", f"Loaded bidder record with {len(documents)} attached document(s)", data={"count": len(documents)})

    # 2. DOCUMENT PROCESSING & LOCAL QWEN EXTRACTION
    log("AI_EXTRACTION_STARTED", f"Running PyMuPDF text parser and Local Qwen ({ollama_model}) on documents…")
    extracted_data = process_bidder_documents(
        documents=documents,
        strapi_url=STRAPI_URL,
        ollama_url=ollama_url,
        ollama_model=ollama_model,
        log_fn=log,
    )

    # Use extracted values; fallback to existing bidder fields if no documents were attached
    company_name = (
        extracted_data.get("companyName")
        or bidder.get("companyName")
        or bidder.get("bidderName")
        or "Unknown Entity"
    )
    gstin = extracted_data.get("gstin") or bidder.get("gstin") or ""
    pan = extracted_data.get("panNumber") or bidder.get("panNumber") or ""
    udyam_id = extracted_data.get("udyamId") or bidder.get("udyamId") or ""
    epfo_code = extracted_data.get("epfoCode") or bidder.get("epfoCode") or ""
    esic_code = extracted_data.get("esicCode") or bidder.get("esicCode") or ""
    dpiit_number = extracted_data.get("dpiitNumber") or bidder.get("dpiitNumber") or ""
    nsic_number = extracted_data.get("nsicNumber") or bidder.get("nsicNumber") or ""

    if gstin: log("GST_DATA_EXTRACTED", f"Extracted GSTIN: {gstin}")
    if pan: log("PAN_DATA_EXTRACTED", f"Extracted PAN: {pan}")
    if udyam_id: log("UDYAM_DATA_EXTRACTED", f"Extracted Udyam ID: {udyam_id}")

    # 3. QUERY SIMULATED GOVERNMENT DATABASES
    log("REGISTRY_CHECK_STARTED", f"Querying simulated central registries for {company_name}…")
    try:
        log("DB:GST", f"Verifying GSTIN '{gstin}' against GST Database…")
        gst_record = fetch_gst_status(gstin) if gstin else None

        log("DB:PAN", f"Verifying PAN '{pan}' against Income Tax PAN Database…")
        pan_record = fetch_pan_data(pan) if pan else None

        log("DB:UDYAM", f"Verifying Udyam '{udyam_id}' against MSME Registry…")
        udyam_record = fetch_udyam_data(udyam_id) if udyam_id else None

        log("DB:EPFO", f"Verifying EPFO establishment code '{epfo_code}'…")
        epfo_record = fetch_epfo_data(epfo_code) if epfo_code else None

        log("DB:ESIC", f"Verifying ESIC registration code '{esic_code}'…")
        esic_record = fetch_esic_data(esic_code) if esic_code else None

        log("DB:STARTUP", f"Verifying DPIIT certificate '{dpiit_number}'…")
        startup_record = fetch_startup_data(dpiit_number) if dpiit_number else None

        log("DB:NSIC", f"Verifying NSIC certificate '{nsic_number}'…")
        nsic_record = fetch_nsic_data(nsic_number) if nsic_number else None

        log("DB:BLACKLIST", f"Checking Central Blacklist / Debarment database for {company_name}…")
        blacklist_record = check_blacklist(gstin, pan, company_name)
    except StrapiClientError as exc:
        log("DB:ERROR", f"Registry verification failed: {exc}", level="ERROR")
        return {
            "error": f"Database query failed: {exc}",
            "bidderId": str(bidder_id),
            "overallScore": 0,
            "riskLevel": "Critical",
            "recommendation": "MANUAL_REVIEW",
        }

    # 4. DETERMINISTIC RULE ENGINE
    log("RULE_ENGINE_STARTED", "Evaluating deterministic statutory compliance rules…")
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

    for check in checks.values():
        check["checkedAt"] = verified_at

    # 5. SCORE AND RISK CALCULATION
    score, risk = calculate_score(checks)
    recommendation = determine_recommendation(score, risk, checks)
    log("SCORE_CALCULATED", f"Calculated compliance score: {score}/100 · Risk: {risk} · Recommendation: {recommendation}",
        data={"score": score, "risk": risk, "recommendation": recommendation})

    # Discrepancies
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

    # 6. LOCAL QWEN EXPLANATORY SUMMARY
    log("AI_SUMMARY_GENERATED", f"Generating explanatory summary via Local Qwen ({ollama_model})…")
    ai_summary, confidence, ai_source = _generate_ai_summary_local_qwen(
        company_name, score, risk, recommendation, checks,
        ollama_url=ollama_url,
        ollama_model=ollama_model,
        log_fn=log,
    )

    # 7. BUILD FINAL RESULT
    result = {
        "bidderId": str(bidder_id),
        "companyName": company_name,
        "overallScore": score,
        "riskLevel": risk,
        "recommendation": recommendation,
        "checks": checks,
        "discrepancies": discrepancies,
        "extractedData": extracted_data,
        "evidence": [],
        "aiSummary": ai_summary,
        "aiSource": ai_source,
        "confidence": confidence,
        "verifiedAt": verified_at,
        "verificationMode": "DOCUMENT_FIRST_LOCAL_AI",
    }

    # 8. PERSIST IN STRAPI (BIDDER + VERIFICATION LOG)
    document_id = bidder.get("documentId")
    log("SAVE", f"Saving verification result and extracted data for {company_name} to Strapi…")
    try:
        save_verification_result(bidder_id, result, document_id=document_id)
        create_verification_log(bidder_id, f"Verification complete — {recommendation}", result, document_id=document_id)
        log("VERIFICATION_COMPLETED", f"Verification successfully finalized for {company_name} ({recommendation})",
            data={"score": score, "recommendation": recommendation})
    except StrapiClientError as exc:
        log("SAVE:ERROR", f"Failed to persist to Strapi: {exc}", level="ERROR")
        raise StrapiClientError(f"Verification calculated but could not be saved: {exc}") from exc

    return result


async def run_verification_async(
    bidder_id: str | int,
    semaphore: asyncio.Semaphore,
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "qwen2.5:7b",
    log_fn=None,
) -> dict[str, Any]:
    """Async wrapper for batch verification with rate limiting."""
    async with semaphore:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, run_verification, bidder_id, ollama_url, ollama_model, log_fn
        )