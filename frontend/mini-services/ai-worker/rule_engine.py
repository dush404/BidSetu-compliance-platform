"""
Deterministic compliance rule engine.
The LLM does NOT make pass/fail decisions — this module does.
AI is used only for text generation (summaries, explanations).
"""

from datetime import datetime, timezone
from typing import Any

CheckStatus = str  # "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE"


def _is_date_old(date_str: str | None, months: int = 6) -> bool:
    """Return True if date_str is older than `months` months from today."""
    if not date_str:
        return True
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta_months = (now.year - dt.year) * 12 + (now.month - dt.month)
        return delta_months > months
    except Exception:
        return True


def check_gst(
    submitted_gstin: str | None,
    db_record: dict[str, Any] | None,
    submitted_name: str | None = None,
) -> dict[str, Any]:
    """GST compliance check — deterministic rules."""
    if not submitted_gstin:
        return {
            "status": "NOT_APPLICABLE",
            "reason": "No GSTIN submitted.",
            "submitted": {},
            "verified": {},
        }

    if db_record is None:
        return {
            "status": "FAIL",
            "reason": f"GSTIN {submitted_gstin} not found in government database.",
            "submitted": {"gstin": submitted_gstin},
            "verified": {},
            "severity": "HIGH",
        }

    db_status = db_record.get("statusId") or db_record.get("status", "")
    db_name = db_record.get("legalName") or db_record.get("tradeName", "")
    last_return = db_record.get("lastReturnFiled")

    result: dict[str, Any] = {
        "submitted": {"gstin": submitted_gstin, "name": submitted_name or ""},
        "verified": {"gstin": submitted_gstin, "name": db_name, "status": db_status},
        "source": "GSTN (Simulated)",
    }

    if db_status not in ("Active",):
        result["status"] = "FAIL"
        result["reason"] = f"GST registration is {db_status}. Only Active registrations are accepted."
        result["severity"] = "HIGH"
        return result

    # Name mismatch check
    if submitted_name and db_name:
        sub_norm = submitted_name.lower().strip()
        db_norm = db_name.lower().strip()
        if sub_norm not in db_norm and db_norm not in sub_norm:
            # Partial match tolerance — flag for review
            result["status"] = "REVIEW"
            result["reason"] = (
                f"Company name mismatch: submitted '{submitted_name}', "
                f"database shows '{db_name}'."
            )
            return result

    # Late filing check
    if _is_date_old(last_return, months=6):
        result["status"] = "REVIEW"
        result["reason"] = f"GST returns not filed recently (last filed: {last_return or 'unknown'})."
        return result

    result["status"] = "PASS"
    result["reason"] = f"GST registration is Active. Returns filed on {last_return}."
    return result


def check_pan(
    submitted_pan: str | None,
    db_record: dict[str, Any] | None,
    submitted_name: str | None = None,
) -> dict[str, Any]:
    """PAN compliance check."""
    if not submitted_pan:
        return {"status": "NOT_APPLICABLE", "reason": "No PAN submitted.", "submitted": {}, "verified": {}}

    if db_record is None:
        return {
            "status": "FAIL",
            "reason": f"PAN {submitted_pan} not found in Income Tax database.",
            "submitted": {"pan": submitted_pan},
            "verified": {},
            "severity": "HIGH",
        }

    db_status = db_record.get("statusId") or db_record.get("status", "")
    db_name = db_record.get("holderName", "")

    result: dict[str, Any] = {
        "submitted": {"pan": submitted_pan, "name": submitted_name or ""},
        "verified": {"pan": submitted_pan, "name": db_name, "status": db_status},
        "source": "Income Tax Dept. (Simulated)",
    }

    if db_status == "Blacklisted":
        result["status"] = "FAIL"
        result["reason"] = "PAN is blacklisted by Income Tax Department."
        result["severity"] = "CRITICAL"
        return result

    if db_status not in ("Valid",):
        result["status"] = "FAIL"
        result["reason"] = f"PAN status is {db_status}."
        result["severity"] = "HIGH"
        return result

    # Name check
    if submitted_name and db_name:
        sub_norm = submitted_name.lower().strip()
        db_norm = db_name.lower().strip()
        if sub_norm not in db_norm and db_norm not in sub_norm:
            result["status"] = "FAIL"
            result["reason"] = (
                f"PAN holder name mismatch: submitted '{submitted_name}', "
                f"Income Tax shows '{db_name}'."
            )
            result["severity"] = "HIGH"
            return result

    result["status"] = "PASS"
    result["reason"] = "PAN is valid and name matches."
    return result


def check_udyam(
    udyam_id: str | None,
    db_record: dict[str, Any] | None,
    tender_requires_msme: bool = False,
) -> dict[str, Any]:
    """Udyam/MSME check. If tender does not require MSME, absence is not a failure."""
    if not udyam_id:
        if tender_requires_msme:
            return {
                "status": "FAIL",
                "reason": "This tender requires MSME/Udyam registration. None submitted.",
                "submitted": {},
                "verified": {},
                "severity": "HIGH",
            }
        return {
            "status": "NOT_APPLICABLE",
            "reason": "No Udyam ID submitted. Not required for this tender.",
            "submitted": {},
            "verified": {},
        }

    if db_record is None:
        return {
            "status": "FAIL",
            "reason": f"Udyam ID {udyam_id} not found in MSME database.",
            "submitted": {"udyamId": udyam_id},
            "verified": {},
            "severity": "MEDIUM",
        }

    db_status = db_record.get("statusId") or db_record.get("status", "")
    db_name = db_record.get("enterpriseName", "")

    result: dict[str, Any] = {
        "submitted": {"udyamId": udyam_id},
        "verified": {"udyamId": udyam_id, "name": db_name, "status": db_status},
        "source": "MSME Ministry (Simulated)",
    }

    if db_status == "Expired":
        result["status"] = "REVIEW"
        result["reason"] = "Udyam/MSME registration has expired. Renewal required."
        return result

    if db_status not in ("Active",):
        result["status"] = "FAIL"
        result["reason"] = f"Udyam registration is {db_status}."
        result["severity"] = "MEDIUM"
        return result

    result["status"] = "PASS"
    result["reason"] = f"Udyam registration is Active. Enterprise: {db_name}."
    return result


def check_epfo(
    epfo_code: str | None,
    db_record: dict[str, Any] | None,
) -> dict[str, Any]:
    """EPFO compliance check."""
    if not epfo_code:
        return {"status": "NOT_APPLICABLE", "reason": "No EPFO code submitted.", "submitted": {}, "verified": {}}

    if db_record is None:
        return {
            "status": "REVIEW",
            "reason": f"EPFO code {epfo_code} not found in EPFO database. Manual verification needed.",
            "submitted": {"epfoCode": epfo_code},
            "verified": {},
        }

    db_status = db_record.get("status", "")
    result: dict[str, Any] = {
        "submitted": {"epfoCode": epfo_code},
        "verified": {"epfoCode": epfo_code, "status": db_status, "name": db_record.get("establishmentName", "")},
        "source": "EPFO (Simulated)",
    }

    if db_status != "Compliant":
        result["status"] = "FAIL"
        result["reason"] = f"EPFO compliance status: {db_status}. Employer must be EPFO compliant."
        return result

    result["status"] = "PASS"
    result["reason"] = "EPFO compliance is current."
    return result


def check_esic(
    esic_code: str | None,
    db_record: dict[str, Any] | None,
) -> dict[str, Any]:
    """ESIC compliance check."""
    if not esic_code:
        return {"status": "NOT_APPLICABLE", "reason": "No ESIC code submitted.", "submitted": {}, "verified": {}}

    if db_record is None:
        return {
            "status": "REVIEW",
            "reason": f"ESIC code {esic_code} not found.",
            "submitted": {"esicCode": esic_code},
            "verified": {},
        }

    db_status = db_record.get("status", "")
    result: dict[str, Any] = {
        "submitted": {"esicCode": esic_code},
        "verified": {"esicCode": esic_code, "status": db_status},
        "source": "ESIC (Simulated)",
    }

    if db_status != "Compliant":
        result["status"] = "FAIL"
        result["reason"] = f"ESIC compliance status: {db_status}."
        return result

    result["status"] = "PASS"
    result["reason"] = "ESIC compliance is current."
    return result


def check_startup_india(
    dpiit_number: str | None,
    db_record: dict[str, Any] | None,
) -> dict[str, Any]:
    """DPIIT Startup India check."""
    if not dpiit_number:
        return {"status": "NOT_APPLICABLE", "reason": "No DPIIT number submitted.", "submitted": {}, "verified": {}}

    if db_record is None:
        return {
            "status": "REVIEW",
            "reason": f"DPIIT number {dpiit_number} not found.",
            "submitted": {"dpiitNumber": dpiit_number},
            "verified": {},
        }

    db_status = db_record.get("status", "")
    result: dict[str, Any] = {
        "submitted": {"dpiitNumber": dpiit_number},
        "verified": {"dpiitNumber": dpiit_number, "status": db_status},
        "source": "DPIIT (Simulated)",
    }

    if db_status not in ("Recognized",):
        result["status"] = "FAIL"
        result["reason"] = f"Startup India recognition status: {db_status}."
        return result

    result["status"] = "PASS"
    result["reason"] = "Startup India recognition is valid."
    return result


def check_nsic(
    nsic_number: str | None,
    db_record: dict[str, Any] | None,
) -> dict[str, Any]:
    """NSIC check."""
    if not nsic_number:
        return {"status": "NOT_APPLICABLE", "reason": "No NSIC number submitted.", "submitted": {}, "verified": {}}

    if db_record is None:
        return {"status": "REVIEW", "reason": "NSIC number not found.", "submitted": {"nsicNumber": nsic_number}, "verified": {}}

    db_status = db_record.get("status", "")
    result: dict[str, Any] = {
        "submitted": {"nsicNumber": nsic_number},
        "verified": {"nsicNumber": nsic_number, "status": db_status},
        "source": "NSIC (Simulated)",
    }

    if db_status not in ("Active",):
        result["status"] = "FAIL"
        result["reason"] = f"NSIC registration status: {db_status}."
        return result

    result["status"] = "PASS"
    result["reason"] = "NSIC registration is active."
    return result


def check_blacklist_rule(blacklist_record: dict[str, Any] | None) -> dict[str, Any]:
    """Blacklist check — if found, always FAIL (CRITICAL)."""
    if blacklist_record:
        return {
            "status": "FAIL",
            "reason": (
                f"Entity is blacklisted/debarred: {blacklist_record.get('reason', 'Violation of procurement norms')}. "
                f"Debarred until: {blacklist_record.get('debarredUntil', 'Unknown')}."
            ),
            "verified": {
                "entityName": blacklist_record.get("entityName", ""),
                "reason": blacklist_record.get("reason", ""),
                "debarredUntil": blacklist_record.get("debarredUntil", ""),
            },
            "submitted": {},
            "source": "Central Blacklist Registry (Simulated)",
            "severity": "CRITICAL",
        }
    return {
        "status": "PASS",
        "reason": "Entity not found in blacklist/debarment registry.",
        "submitted": {},
        "verified": {"blacklisted": False},
        "source": "Central Blacklist Registry (Simulated)",
    }


# ── Score calculation ──────────────────────────────────────────────────────────

WEIGHTS = {
    "gst": 25,
    "pan": 20,
    "udyam": 10,
    "epfo": 10,
    "esic": 10,
    "startupIndia": 5,
    "nsic": 5,
    "blacklist": 15,
}

CRITICAL_WEIGHT = 15  # Blacklist contributes full 15 on PASS


def calculate_score(checks: dict[str, dict]) -> tuple[int, str]:
    """
    Returns (score, risk_level).
    - Any CRITICAL (blacklist) failure → score 0, CRITICAL risk.
    - Score is weighted sum of passing checks.
    - NOT_APPLICABLE checks are excluded from denominator.
    """
    # Blacklist CRITICAL override
    blacklist = checks.get("blacklist", {})
    if blacklist.get("status") == "FAIL" and blacklist.get("severity") == "CRITICAL":
        return 0, "Critical"

    total_weight = 0
    earned_weight = 0

    for key, weight in WEIGHTS.items():
        check = checks.get(key, {})
        status = check.get("status", "NOT_APPLICABLE")
        if status == "NOT_APPLICABLE":
            continue
        total_weight += weight
        if status == "PASS":
            earned_weight += weight
        elif status == "REVIEW":
            earned_weight += weight * 0.5  # Partial credit for REVIEW

    if total_weight == 0:
        return 50, "Medium"

    score = round((earned_weight / total_weight) * 100)

    if score >= 85:
        risk = "Low"
    elif score >= 65:
        risk = "Medium"
    elif score >= 40:
        risk = "High"
    else:
        risk = "Critical"

    return score, risk


def determine_recommendation(score: int, risk: str, checks: dict) -> str:
    """Deterministic recommendation."""
    blacklist = checks.get("blacklist", {})
    if blacklist.get("status") == "FAIL":
        return "DISQUALIFY"

    gst = checks.get("gst", {})
    if gst.get("status") == "FAIL" and gst.get("severity") == "HIGH":
        return "DISQUALIFY" if score < 50 else "MANUAL_REVIEW"

    if risk == "Critical" or score < 40:
        return "DISQUALIFY"
    if risk == "High" or score < 70:
        return "MANUAL_REVIEW"

    fail_count = sum(1 for c in checks.values() if c.get("status") == "FAIL")
    if fail_count >= 2:
        return "MANUAL_REVIEW"

    return "QUALIFY"
