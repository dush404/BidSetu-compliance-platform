"""Full Strapi REST client used by the AI verification worker."""

import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

STRAPI_URL = os.getenv("STRAPI_URL", "http://localhost:1337").rstrip("/")
STRAPI_API_KEY = os.getenv("STRAPI_API_TOKEN") or os.getenv("STRAPI_API_KEY", "")
REQUEST_TIMEOUT = 10

HEADERS = {
    "Authorization": f"Bearer {STRAPI_API_KEY}",
    "Content-Type": "application/json",
}


class StrapiClientError(RuntimeError):
    """Raised when a Strapi request cannot be completed or decoded."""


def _get(endpoint: str, params: dict[str, str] | None = None) -> dict[str, Any]:
    """Raw GET — returns full Strapi response dict."""
    try:
        response = requests.get(
            f"{STRAPI_URL}/api/{endpoint}",
            params=params or {},
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        raise StrapiClientError(f"Strapi GET failed [{endpoint}]: {exc}") from exc


def _fetch_first(endpoint: str, params: dict[str, str]) -> dict[str, Any] | None:
    """Return attributes of the first matching record, or None."""
    data = _get(endpoint, params)
    records = data.get("data", [])
    if not records:
        return None
    record = records[0]
    return record.get("attributes", record)


def _put(endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
    """PUT to update a Strapi record."""
    try:
        response = requests.put(
            f"{STRAPI_URL}/api/{endpoint}",
            json=payload,
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        detail = ""
        if isinstance(exc, requests.HTTPError) and exc.response is not None:
            detail = f" — {exc.response.text[:500]}"
        raise StrapiClientError(f"Strapi PUT failed [{endpoint}]: {exc}{detail}") from exc


def _post(endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
    """POST to create a new Strapi record."""
    try:
        response = requests.post(
            f"{STRAPI_URL}/api/{endpoint}",
            json=payload,
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        detail = ""
        if isinstance(exc, requests.HTTPError) and exc.response is not None:
            detail = f" — {exc.response.text[:500]}"
        raise StrapiClientError(f"Strapi POST failed [{endpoint}]: {exc}{detail}") from exc


# ── Tender ──────────────────────────────────────────────────────────────────

def get_tender(tender_id: int) -> dict[str, Any] | None:
    """Return tender attributes by Strapi numeric ID."""
    try:
        data = _get("tenders", {"filters[id][$eq]": str(tender_id), "populate": "*"})
        records = data.get("data", [])
        if not records: return None
        record = records[0]
        return record.get("attributes", record)
    except StrapiClientError:
        return None


def get_bidders_for_tender(tender_id: int) -> list[dict[str, Any]]:
    """Return list of bidder-application records for a tender."""
    try:
        data = _get(
            "bidder-applications",
            {
                "filters[tender][id][$eq]": str(tender_id),
                "populate": "*",
                "pagination[limit]": "100",
            },
        )
        return data.get("data", [])
    except StrapiClientError:
        return []


def get_bidder(bidder_id: str | int) -> dict[str, Any] | None:
    """Return a single bidder-application by Strapi numeric ID or documentId.

    Strapi 5 item routes require documentId, while the UI uses numeric IDs.
    Querying by the numeric id keeps both sides compatible.
    """
    bidder_str = str(bidder_id)

    # 1. Try direct GET if bidder_id is a documentId
    try:
        data = _get(f"bidder-applications/{bidder_str}", {"populate": "*"})
        records = data.get("data", [])
        if records:
            record = records[0] if isinstance(records, list) else records
            attrs = record.get("attributes", record)
            attrs["documentId"] = record.get("documentId", bidder_str)
            attrs["_id"] = record.get("id")
            return attrs
    except StrapiClientError:
        pass

    # 2. Try filter by documentId
    try:
        data = _get(
            "bidder-applications",
            {
                "filters[documentId][$eq]": bidder_str,
                "populate": "*",
                "pagination[limit]": "1",
            },
        )
        records = data.get("data", [])
        if records:
            record = records[0]
            attrs = record.get("attributes", record)
            attrs["documentId"] = record.get("documentId", bidder_str)
            attrs["_id"] = record.get("id")
            return attrs
    except StrapiClientError:
        pass

    # 3. Try filter by numeric id
    try:
        data = _get(
            "bidder-applications",
            {
                "filters[id][$eq]": bidder_str,
                "populate": "*",
                "pagination[limit]": "1",
            },
        )
        records = data.get("data", [])
        if records:
            record = records[0]
            attrs = record.get("attributes", record)
            attrs["documentId"] = record.get("documentId")
            attrs["_id"] = record.get("id")
            return attrs
    except StrapiClientError:
        pass

    return None


# ── Government databases ─────────────────────────────────────────────────────

def fetch_gst_status(gstin: str) -> dict[str, Any] | None:
    """Return the first GST record matching the GSTIN."""
    if not gstin:
        return None
    return _fetch_first("gst-databases", {"filters[gstin][$eq]": gstin})


def fetch_udyam_data(udyam_id: str) -> dict[str, Any] | None:
    """Return the first Udyam record matching the Udyam number."""
    if not udyam_id:
        return None
    return _fetch_first("udyam-databases", {"filters[udyamNumber][$eq]": udyam_id})


def fetch_pan_data(pan: str) -> dict[str, Any] | None:
    """Return the first PAN record matching the PAN number."""
    if not pan:
        return None
    return _fetch_first("pan-databases", {"filters[panNumber][$eq]": pan})


def fetch_epfo_data(code: str) -> dict[str, Any] | None:
    """Return the first EPFO record matching the establishment code."""
    if not code:
        return None
    return _fetch_first("epfo-databases", {"filters[establishmentCode][$eq]": code})


def fetch_esic_data(code: str) -> dict[str, Any] | None:
    """Return the first ESIC record matching the ESIC code."""
    if not code:
        return None
    return _fetch_first("esic-databases", {"filters[esicCode][$eq]": code})


def fetch_startup_data(dpiit_number: str) -> dict[str, Any] | None:
    """Return the first Startup India record matching the DPIIT number."""
    if not dpiit_number:
        return None
    return _fetch_first("startup-india-databases", {"filters[dpiitNumber][$eq]": dpiit_number})


def fetch_nsic_data(nsic_number: str) -> dict[str, Any] | None:
    """Return the first NSIC record matching the NSIC number."""
    if not nsic_number:
        return None
    return _fetch_first("nsic-databases", {"filters[nsicNumber][$eq]": nsic_number})


def check_blacklist(gstin: str | None, pan: str | None, company_name: str | None = None) -> dict[str, Any] | None:
    """Return the blacklist record if entity is blacklisted, else None."""
    filters: dict[str, str] = {}
    idx = 0
    if gstin:
        filters[f"filters[$or][{idx}][gstin][$eq]"] = gstin
        idx += 1
    if pan:
        filters[f"filters[$or][{idx}][pan][$eq]"] = pan
        idx += 1
    if company_name:
        filters[f"filters[$or][{idx}][entityName][$containsi]"] = company_name

    if not filters:
        return None

    try:
        data = _get("blacklist-databases", filters)
        records = data.get("data", [])
        if records:
            return records[0].get("attributes", records[0])
        return None
    except StrapiClientError:
        return None


# ── Saving results ────────────────────────────────────────────────────────────

def save_verification_result(
    bidder_id: str | int,
    result: dict[str, Any],
    document_id: str | None = None,
) -> None:
    """Update the bidder-application record with the verification result."""
    recommendation = result.get("recommendation")
    status_by_recommendation = {
        "QUALIFY": "Verified",
        "DISQUALIFY": "Rejected",
        "MANUAL_REVIEW": "Manual Review",
    }
    extracted_data = result.get("extractedData") or {}
    data_payload = {
        "verificationStatus": status_by_recommendation.get(
            recommendation, "Manual Review"
        ),
        "complianceScore": result.get("overallScore"),
        "riskLevel": result.get("riskLevel"),
        "aiRecommendation": result.get("aiSummary", ""),
        "verificationResult": result,
        "lastVerifiedAt": result.get("verifiedAt"),
    }
    if extracted_data:
        data_payload["extractedData"] = extracted_data
        if extracted_data.get("companyName"):
            data_payload["companyName"] = extracted_data["companyName"]
        if extracted_data.get("gstin"):
            data_payload["gstin"] = extracted_data["gstin"]
        if extracted_data.get("panNumber"):
            data_payload["panNumber"] = extracted_data["panNumber"]
        if extracted_data.get("udyamId"):
            data_payload["udyamId"] = extracted_data["udyamId"]
        if extracted_data.get("epfoCode"):
            data_payload["epfoCode"] = extracted_data["epfoCode"]
        if extracted_data.get("esicCode"):
            data_payload["esicCode"] = extracted_data["esicCode"]
        if extracted_data.get("dpiitNumber"):
            data_payload["dpiitNumber"] = extracted_data["dpiitNumber"]
        if extracted_data.get("nsicNumber"):
            data_payload["nsicNumber"] = extracted_data["nsicNumber"]

    payload = {"data": data_payload}
    if not document_id:
        bidder = get_bidder(bidder_id)
        document_id = bidder.get("documentId") if bidder else None
    if not document_id:
        raise StrapiClientError(f"Bidder {bidder_id} has no Strapi documentId")
    _put(f"bidder-applications/{document_id}", payload)


def create_verification_log(
    bidder_id: str | int,
    action: str,
    details: dict[str, Any],
    document_id: str | None = None,
) -> None:
    """Create a VerificationLog entry."""
    if not document_id:
        bidder = get_bidder(bidder_id)
        document_id = bidder.get("documentId") if bidder else None
    if not document_id:
        raise StrapiClientError(f"Bidder {bidder_id} has no documentId for verification log")

    log_payload = {
        "data": {
            "bidder": {"connect": [document_id]},
            "action": action,
            "timestamp": details.get("verifiedAt"),
            "complianceScore": details.get("overallScore"),
            # Verification logs support Low/Medium/High; Critical is recorded in detailsLog.
            "riskLevel": details.get("riskLevel") if details.get("riskLevel") != "Critical" else "High",
            "aiSource": details.get("aiSource", "AI Worker"),
            "detailsLog": details,
        }
    }
    _post("verification-logs", log_payload)
