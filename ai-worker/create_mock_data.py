"""
Comprehensive mock data seed script.
Creates 5+ tenders, 20+ bidders, and all supporting database records
covering all 8 required compliance scenarios.

Usage:
  Set STRAPI_API_TOKEN env var, then:
  python create_mock_data.py

  Or set STRAPI_URL if Strapi is not on localhost:1337
"""

import os
import sys
from pathlib import Path
from typing import Any

import requests


def load_env_file() -> None:
    """Load environment variables from the local .env file if present."""
    env_file = Path(__file__).resolve().with_name(".env")
    if not env_file.exists():
        return

    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env_file()

STRAPI_URL = os.getenv("STRAPI_URL", "http://localhost:1337/api").rstrip("/")
API_TOKEN = os.getenv("STRAPI_API_TOKEN", os.getenv("STRAPI_API_KEY", ""))

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json",
}


def post(endpoint: str, data: dict[str, Any]) -> dict[str, Any] | None:
    resp = requests.post(f"{STRAPI_URL}/{endpoint}", json={"data": data}, headers=HEADERS, timeout=20)
    if resp.status_code >= 400:
        print(f"ERROR posting to {endpoint}: {resp.status_code} — {resp.text[:200]}")
        return None
    created = resp.json().get("data", {})
    name = (data.get("title") or data.get("gstin") or data.get("udyamNumber") or
            data.get("entityName") or data.get("bidderName") or data.get("establishmentCode") or
            data.get("dpiitNumber") or data.get("nsicNumber") or data.get("esicCode") or
            data.get("panNumber") or "record")
    print(f"  ✓ {endpoint}: id={created.get('id')} — {name}")
    return created


def create_all(endpoint: str, records: list[dict]) -> list[int]:
    """Create multiple records and return their IDs."""
    ids = []
    for rec in records:
        created = post(endpoint, rec)
        if created:
            ids.append(created.get("id"))
    return ids


# ═══════════════════════════════════════════════════════════════════════════════
# GST DATABASE — 10 records
# ═══════════════════════════════════════════════════════════════════════════════
GST_DATA = [
    # Scenario A — Perfect: Active, recent filing
    {"gstin": "27AABCU9603R1Z5", "legalName": "TechServe Solutions Pvt Ltd",
     "tradeName": "TechServe Solutions", "statusId": "Active",
     "lastReturnFiled": "2024-06-30", "textComplianceRating": 95},

    # Scenario B — GST Cancelled (mismatch)
    {"gstin": "27BBCDU1234R1Z6", "legalName": "Infra Build Corp",
     "tradeName": "Infra Build", "statusId": "Cancelled",
     "lastReturnFiled": "2022-01-01", "textComplianceRating": 10},

    # Scenario C — Blacklisted bidder (GST is Active, but blacklist will catch them)
    {"gstin": "27QQQQ1234Q1Z9", "legalName": "Risky Traders Pvt Ltd",
     "tradeName": "Risky Traders", "statusId": "Active",
     "lastReturnFiled": "2024-05-31", "textComplianceRating": 40},

    # Scenario D — Udyam Expired (GST OK)
    {"gstin": "27XYZAB1234C1Z7", "legalName": "GreenField Supplies",
     "tradeName": "GreenField", "statusId": "Active",
     "lastReturnFiled": "2024-07-31", "textComplianceRating": 80},

    # Scenario E — PAN Name Mismatch (GST Active but wrong name in PAN)
    {"gstin": "27AAACV1234D1Z8", "legalName": "Apex Systems Ltd",
     "tradeName": "Apex Systems", "statusId": "Active",
     "lastReturnFiled": "2024-06-30", "textComplianceRating": 85},

    # Scenario F — Multiple discrepancies (GST Suspended)
    {"gstin": "27ZZZZ4321Z1Z2", "legalName": "Dubious Contractors",
     "tradeName": "Dubious Contractors", "statusId": "Suspended",
     "lastReturnFiled": "2021-03-31", "textComplianceRating": 5},

    # Scenario G — Late GST filer (GST Active but old filing)
    {"gstin": "27MMMM5678M1Z3", "legalName": "SlowPay Enterprises",
     "tradeName": "SlowPay", "statusId": "Active",
     "lastReturnFiled": "2023-01-31", "textComplianceRating": 50},

    # Scenario H — Clean non-MSME (no Udyam, but not required)
    {"gstin": "27PPPP9876P1Z4", "legalName": "National Infrastructure Ltd",
     "tradeName": "NatInfra", "statusId": "Active",
     "lastReturnFiled": "2024-07-31", "textComplianceRating": 92},

    # Extra bidders for tender volume
    {"gstin": "27AAAA1111A1Z1", "legalName": "Sunrise Tech Pvt Ltd",
     "tradeName": "Sunrise Tech", "statusId": "Active",
     "lastReturnFiled": "2024-05-31", "textComplianceRating": 88},

    {"gstin": "27BBBB2222B1Z2", "legalName": "Coastline Engineering",
     "tradeName": "Coastline Engg", "statusId": "Active",
     "lastReturnFiled": "2024-04-30", "textComplianceRating": 78},
]

# ═══════════════════════════════════════════════════════════════════════════════
# PAN DATABASE — 10 records
# ═══════════════════════════════════════════════════════════════════════════════
PAN_DATA = [
    {"panNumber": "AABCU9603R", "holderName": "TechServe Solutions Pvt Ltd",
     "statusId": "Valid", "lastItrFiled": "2024-07-31"},

    {"panNumber": "BBCDU1234D", "holderName": "Infra Build Corp",
     "statusId": "Valid", "lastItrFiled": "2022-06-30"},

    {"panNumber": "QQQPQ1234Q", "holderName": "Risky Traders Pvt Ltd",
     "statusId": "Blacklisted", "lastItrFiled": "2023-07-31"},

    # Scenario D — Udyam expired, PAN valid
    {"panNumber": "XYZAB1234X", "holderName": "GreenField Supplies",
     "statusId": "Valid", "lastItrFiled": "2024-07-31"},

    # Scenario E — PAN Name mismatch (PAN holder name is different from company)
    {"panNumber": "AAACV1234A", "holderName": "WRONGNAME Pvt Ltd",
     "statusId": "Valid", "lastItrFiled": "2024-06-30"},

    # Scenario F — Multiple discrepancies
    {"panNumber": "ZZZZZ4321Z", "holderName": "Dubious Contractors",
     "statusId": "Invalid", "lastItrFiled": "2021-07-31"},

    {"panNumber": "MMMMP5678M", "holderName": "SlowPay Enterprises",
     "statusId": "Valid", "lastItrFiled": "2023-07-31"},

    {"panNumber": "PPPPP9876P", "holderName": "National Infrastructure Ltd",
     "statusId": "Valid", "lastItrFiled": "2024-07-31"},

    {"panNumber": "AAAAA1111A", "holderName": "Sunrise Tech Pvt Ltd",
     "statusId": "Valid", "lastItrFiled": "2024-06-30"},

    {"panNumber": "BBBBB2222B", "holderName": "Coastline Engineering",
     "statusId": "Valid", "lastItrFiled": "2024-05-31"},
]

# ═══════════════════════════════════════════════════════════════════════════════
# UDYAM DATABASE — 8 records
# ═══════════════════════════════════════════════════════════════════════════════
UDYAM_DATA = [
    {"udyamNumber": "UDYAM-MH-01-2024000001", "enterpriseName": "TechServe Solutions Pvt Ltd",
     "catagory": "Small", "statusId": "Active", "registrationDate": "2024-01-15"},

    # Scenario D — Udyam expired
    {"udyamNumber": "UDYAM-MH-01-2022000003", "enterpriseName": "GreenField Supplies",
     "catagory": "Micro", "statusId": "Expired", "registrationDate": "2022-05-05"},

    {"udyamNumber": "UDYAM-MH-01-2023000002", "enterpriseName": "Apex Systems Ltd",
     "catagory": "Small", "statusId": "Active", "registrationDate": "2023-06-20"},

    {"udyamNumber": "UDYAM-MH-01-2024000004", "enterpriseName": "Sunrise Tech Pvt Ltd",
     "catagory": "Micro", "statusId": "Active", "registrationDate": "2024-02-10"},

    {"udyamNumber": "UDYAM-MH-01-2024000005", "enterpriseName": "SlowPay Enterprises",
     "catagory": "Small", "statusId": "Active", "registrationDate": "2023-11-01"},

    {"udyamNumber": "UDYAM-MH-01-2024000006", "enterpriseName": "Risky Traders Pvt Ltd",
     "catagory": "Micro", "statusId": "Cancelled", "registrationDate": "2023-03-15"},

    {"udyamNumber": "UDYAM-MH-01-2024000007", "enterpriseName": "Coastline Engineering",
     "catagory": "Small", "statusId": "Active", "registrationDate": "2024-03-20"},

    {"udyamNumber": "UDYAM-DL-01-2024000008", "enterpriseName": "SmartBuild Pvt Ltd",
     "catagory": "Medium", "statusId": "Active", "registrationDate": "2024-01-10"},
]

# ═══════════════════════════════════════════════════════════════════════════════
# EPFO DATABASE — 8 records
# ═══════════════════════════════════════════════════════════════════════════════
EPFO_DATA = [
    {"establishmentCode": "MHBAN0012345", "establishmentName": "TechServe Solutions Pvt Ltd",
     "status": "Compliant", "lastComplianceDate": "2024-07-31", "employeeCount": 45},

    {"establishmentCode": "MHBAN0023456", "establishmentName": "Infra Build Corp",
     "status": "Non-Compliant", "lastComplianceDate": "2022-12-31", "employeeCount": 120},

    {"establishmentCode": "MHBAN0034567", "establishmentName": "GreenField Supplies",
     "status": "Compliant", "lastComplianceDate": "2024-06-30", "employeeCount": 12},

    {"establishmentCode": "MHBAN0045678", "establishmentName": "Apex Systems Ltd",
     "status": "Compliant", "lastComplianceDate": "2024-07-31", "employeeCount": 67},

    {"establishmentCode": "MHBAN0056789", "establishmentName": "SlowPay Enterprises",
     "status": "Compliant", "lastComplianceDate": "2024-05-31", "employeeCount": 23},

    {"establishmentCode": "MHBAN0067890", "establishmentName": "National Infrastructure Ltd",
     "status": "Compliant", "lastComplianceDate": "2024-07-31", "employeeCount": 850},

    {"establishmentCode": "MHBAN0078901", "establishmentName": "Sunrise Tech Pvt Ltd",
     "status": "Compliant", "lastComplianceDate": "2024-06-30", "employeeCount": 35},

    {"establishmentCode": "MHBAN0089012", "establishmentName": "Coastline Engineering",
     "status": "Compliant", "lastComplianceDate": "2024-04-30", "employeeCount": 28},
]

# ═══════════════════════════════════════════════════════════════════════════════
# ESIC DATABASE — 8 records
# ═══════════════════════════════════════════════════════════════════════════════
ESIC_DATA = [
    {"esicCode": "ESIC-MH-000001", "establishmentName": "TechServe Solutions Pvt Ltd",
     "status": "Compliant", "lastComplianceDate": "2024-07-31"},

    {"esicCode": "ESIC-MH-000002", "establishmentName": "Infra Build Corp",
     "status": "Non-Compliant", "lastComplianceDate": "2022-12-31"},

    {"esicCode": "ESIC-MH-000003", "establishmentName": "GreenField Supplies",
     "status": "Compliant", "lastComplianceDate": "2024-06-30"},

    {"esicCode": "ESIC-MH-000004", "establishmentName": "Apex Systems Ltd",
     "status": "Compliant", "lastComplianceDate": "2024-07-31"},

    {"esicCode": "ESIC-MH-000005", "establishmentName": "SlowPay Enterprises",
     "status": "Compliant", "lastComplianceDate": "2024-05-31"},

    {"esicCode": "ESIC-MH-000006", "establishmentName": "National Infrastructure Ltd",
     "status": "Compliant", "lastComplianceDate": "2024-07-31"},

    {"esicCode": "ESIC-MH-000007", "establishmentName": "Sunrise Tech Pvt Ltd",
     "status": "Compliant", "lastComplianceDate": "2024-06-30"},

    {"esicCode": "ESIC-MH-000008", "establishmentName": "Coastline Engineering",
     "status": "Compliant", "lastComplianceDate": "2024-04-30"},
]

# ═══════════════════════════════════════════════════════════════════════════════
# STARTUP INDIA DATABASE
# ═══════════════════════════════════════════════════════════════════════════════
STARTUP_DATA = [
    {"dpiitNumber": "DPIIT-2024-TS-001", "companyName": "TechServe Solutions Pvt Ltd",
     "status": "Recognized", "recognitionDate": "2024-01-20"},

    {"dpiitNumber": "DPIIT-2024-ST-002", "companyName": "Sunrise Tech Pvt Ltd",
     "status": "Recognized", "recognitionDate": "2024-03-15"},

    {"dpiitNumber": "DPIIT-2022-RT-003", "companyName": "Risky Traders Pvt Ltd",
     "status": "Cancelled", "recognitionDate": "2022-06-01"},
]

# ═══════════════════════════════════════════════════════════════════════════════
# NSIC DATABASE
# ═══════════════════════════════════════════════════════════════════════════════
NSIC_DATA = [
    {"nsicNumber": "NSIC-2024-001", "companyName": "TechServe Solutions Pvt Ltd",
     "status": "Active", "registrationDate": "2024-01-15", "category": "Electronics"},

    {"nsicNumber": "NSIC-2024-002", "companyName": "GreenField Supplies",
     "status": "Expired", "registrationDate": "2022-05-10", "category": "Agriculture"},

    {"nsicNumber": "NSIC-2024-003", "companyName": "Coastline Engineering",
     "status": "Active", "registrationDate": "2023-11-20", "category": "Civil Works"},
]

# ═══════════════════════════════════════════════════════════════════════════════
# BLACKLIST DATABASE — 3 blacklisted entities
# ═══════════════════════════════════════════════════════════════════════════════
BLACKLIST_DATA = [
    # Scenario C — Blacklisted bidder
    {"entityName": "Risky Traders Pvt Ltd", "gstin": "27QQQQ1234Q1Z9",
     "pan": "QQQPQ1234Q",
     "reason": "Fraudulent bidding activity and submission of false documents",
     "debarredUntil": "2027-01-15"},

    {"entityName": "Infra Build Corp", "gstin": "27BBCDU1234R1Z6",
     "pan": "BBCDU1234D",
     "reason": "Non-performance and repeated violations of procurement norms",
     "debarredUntil": "2026-12-31"},

    {"entityName": "Dubious Contractors", "gstin": "27ZZZZ4321Z1Z2",
     "pan": "ZZZZZ4321Z",
     "reason": "Misrepresentation of financial capacity and substandard work",
     "debarredUntil": "2028-06-30"},
]

# ═══════════════════════════════════════════════════════════════════════════════
# TENDERS — 5 tenders
# ═══════════════════════════════════════════════════════════════════════════════
TENDER_DATA = [
    {
        "title": "Supply of IT Hardware and Networking Equipment",
        "tenderId": "TND-2024-001",
        "description": "Procurement of servers, networking switches, and cybersecurity appliances for government offices across Maharashtra.",
        "department": "Ministry of Electronics & IT",
        "statusId": "Open",
        "bidderCount": 8,
        "publishedDate": "2024-08-01T10:00:00.000Z",
        "closingDate": "2024-09-15T17:00:00.000Z",
    },
    {
        "title": "Civil Construction Works for District Warehouse",
        "tenderId": "TND-2024-002",
        "description": "Construction of a 5000 sq.m. district warehouse including civil, electrical, and plumbing works.",
        "department": "Ministry of Rural Development",
        "statusId": "Open",
        "bidderCount": 12,
        "publishedDate": "2024-07-15T10:00:00.000Z",
        "closingDate": "2024-09-30T17:00:00.000Z",
    },
    {
        "title": "Supply of Medical Equipment to PHCs",
        "tenderId": "TND-2024-003",
        "description": "Supply and installation of diagnostic equipment, patient beds, and medical consumables to 50 Primary Health Centres.",
        "department": "Ministry of Health & Family Welfare",
        "statusId": "Open",
        "bidderCount": 6,
        "publishedDate": "2024-08-10T10:00:00.000Z",
        "closingDate": "2024-10-05T17:00:00.000Z",
    },
    {
        "title": "IT Infrastructure Upgrade — State Data Centre",
        "tenderId": "TND-2024-004",
        "description": "Upgrade of network infrastructure, storage systems, and cybersecurity framework at the State Data Centre.",
        "department": "Dept. of Information Technology",
        "statusId": "Closed",
        "bidderCount": 5,
        "publishedDate": "2024-06-01T10:00:00.000Z",
        "closingDate": "2024-07-31T17:00:00.000Z",
    },
    {
        "title": "Solar Power Plant Installation — Government Buildings",
        "tenderId": "TND-2024-005",
        "description": "Design, supply, and installation of rooftop solar power plants (500 kW) across 25 government buildings.",
        "department": "Ministry of New & Renewable Energy",
        "statusId": "Open",
        "bidderCount": 9,
        "publishedDate": "2024-08-20T10:00:00.000Z",
        "closingDate": "2024-10-15T17:00:00.000Z",
    },
]


def seed_bidders(tender_ids: list[int]) -> None:
    """Create 20+ bidders distributed across tenders, covering all 8 scenarios."""
    if not tender_ids:
        print("  ✗ No tender IDs — skipping bidders")
        return

    t1, t2, t3 = (tender_ids + [tender_ids[0]] * 3)[:3]  # Ensure 3 tender refs

    bidders = [
        # ── TENDER 1 — IT Hardware ──────────────────────────────────────────
        # Scenario A: Perfect bidder
        {
            "bidderName": "Rajesh Kumar", "companyName": "TechServe Solutions Pvt Ltd",
            "tender": t1, "gstin": "27AABCU9603R1Z5", "panNumber": "AABCU9603R",
            "udyamId": "UDYAM-MH-01-2024000001", "epfoCode": "MHBAN0012345",
            "esicCode": "ESIC-MH-000001", "dpiitNumber": "DPIIT-2024-TS-001",
            "nsicNumber": "NSIC-2024-001",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        # Scenario B: GST Cancelled
        {
            "bidderName": "Pradeep Singh", "companyName": "Infra Build Corp",
            "tender": t1, "gstin": "27BBCDU1234R1Z6", "panNumber": "BBCDU1234D",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        # Scenario C: Blacklisted
        {
            "bidderName": "Mohan Verma", "companyName": "Risky Traders Pvt Ltd",
            "tender": t1, "gstin": "27QQQQ1234Q1Z9", "panNumber": "QQQPQ1234Q",
            "udyamId": "UDYAM-MH-01-2024000006",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        # Scenario D: Udyam expired
        {
            "bidderName": "Sunita Rao", "companyName": "GreenField Supplies",
            "tender": t1, "gstin": "27XYZAB1234C1Z7", "panNumber": "XYZAB1234X",
            "udyamId": "UDYAM-MH-01-2022000003", "epfoCode": "MHBAN0034567",
            "esicCode": "ESIC-MH-000003",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        # Scenario E: PAN Name Mismatch
        {
            "bidderName": "Vikram Mehta", "companyName": "Apex Systems Ltd",
            "tender": t1, "gstin": "27AAACV1234D1Z8", "panNumber": "AAACV1234A",
            "udyamId": "UDYAM-MH-01-2023000002", "epfoCode": "MHBAN0045678",
            "esicCode": "ESIC-MH-000004",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        # Scenario F: Multiple discrepancies
        {
            "bidderName": "Rahul Sharma", "companyName": "Dubious Contractors",
            "tender": t1, "gstin": "27ZZZZ4321Z1Z2", "panNumber": "ZZZZZ4321Z",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        # Scenario G: Late GST filer
        {
            "bidderName": "Anita Patel", "companyName": "SlowPay Enterprises",
            "tender": t1, "gstin": "27MMMM5678M1Z3", "panNumber": "MMMMP5678M",
            "udyamId": "UDYAM-MH-01-2024000005", "epfoCode": "MHBAN0056789",
            "esicCode": "ESIC-MH-000005",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        # Scenario H: Clean non-MSME (no Udyam, not required)
        {
            "bidderName": "Kapil Sharma", "companyName": "National Infrastructure Ltd",
            "tender": t1, "gstin": "27PPPP9876P1Z4", "panNumber": "PPPPP9876P",
            "epfoCode": "MHBAN0067890", "esicCode": "ESIC-MH-000006",
            "verificationStatus": "Pending", "complianceScore": None,
        },

        # ── TENDER 2 — Civil Works ──────────────────────────────────────────
        {
            "bidderName": "Deepak Agarwal", "companyName": "Sunrise Tech Pvt Ltd",
            "tender": t2, "gstin": "27AAAA1111A1Z1", "panNumber": "AAAAA1111A",
            "udyamId": "UDYAM-MH-01-2024000004", "epfoCode": "MHBAN0078901",
            "esicCode": "ESIC-MH-000007", "dpiitNumber": "DPIIT-2024-ST-002",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Priya Nair", "companyName": "Coastline Engineering",
            "tender": t2, "gstin": "27BBBB2222B1Z2", "panNumber": "BBBBB2222B",
            "udyamId": "UDYAM-MH-01-2024000007", "epfoCode": "MHBAN0089012",
            "esicCode": "ESIC-MH-000008", "nsicNumber": "NSIC-2024-003",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Sanjay Gupta", "companyName": "Infra Build Corp",
            "tender": t2, "gstin": "27BBCDU1234R1Z6", "panNumber": "BBCDU1234D",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Rekha Joshi", "companyName": "GreenField Supplies",
            "tender": t2, "gstin": "27XYZAB1234C1Z7", "panNumber": "XYZAB1234X",
            "udyamId": "UDYAM-MH-01-2022000003",
            "verificationStatus": "Pending", "complianceScore": None,
        },

        # ── TENDER 3 — Medical Equipment ───────────────────────────────────
        {
            "bidderName": "Dr. Mohan Das", "companyName": "TechServe Solutions Pvt Ltd",
            "tender": t3, "gstin": "27AABCU9603R1Z5", "panNumber": "AABCU9603R",
            "udyamId": "UDYAM-MH-01-2024000001", "epfoCode": "MHBAN0012345",
            "esicCode": "ESIC-MH-000001",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Pallavi Menon", "companyName": "Apex Systems Ltd",
            "tender": t3, "gstin": "27AAACV1234D1Z8", "panNumber": "AAACV1234A",
            "epfoCode": "MHBAN0045678", "esicCode": "ESIC-MH-000004",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Ravi Shankar", "companyName": "Risky Traders Pvt Ltd",
            "tender": t3, "gstin": "27QQQQ1234Q1Z9", "panNumber": "QQQPQ1234Q",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Kavitha Reddy", "companyName": "National Infrastructure Ltd",
            "tender": t3, "gstin": "27PPPP9876P1Z4", "panNumber": "PPPPP9876P",
            "epfoCode": "MHBAN0067890", "esicCode": "ESIC-MH-000006",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Suresh Pillai", "companyName": "Dubious Contractors",
            "tender": t3, "gstin": "27ZZZZ4321Z1Z2", "panNumber": "ZZZZZ4321Z",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Nisha Kulkarni", "companyName": "SlowPay Enterprises",
            "tender": t3, "gstin": "27MMMM5678M1Z3", "panNumber": "MMMMP5678M",
            "udyamId": "UDYAM-MH-01-2024000005",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Amit Tripathi", "companyName": "Sunrise Tech Pvt Ltd",
            "tender": t3, "gstin": "27AAAA1111A1Z1", "panNumber": "AAAAA1111A",
            "udyamId": "UDYAM-MH-01-2024000004",
            "verificationStatus": "Pending", "complianceScore": None,
        },
        {
            "bidderName": "Geeta Iyer", "companyName": "Coastline Engineering",
            "tender": t3, "gstin": "27BBBB2222B1Z2", "panNumber": "BBBBB2222B",
            "udyamId": "UDYAM-MH-01-2024000007",
            "verificationStatus": "Pending", "complianceScore": None,
        },
    ]

    for b in bidders:
        tender_id = b.pop("tender")
        b["tender"] = tender_id  # Strapi relation: just the integer ID
        post("bidder-applications", b)


def main():
    if not API_TOKEN:
        print("ERROR: Set STRAPI_API_TOKEN (or STRAPI_API_KEY) before running.")
        print("  export STRAPI_API_TOKEN=<your_full_access_token>")
        sys.exit(1)

    print("\n══════════════════════════════════════════════════")
    print("  AI Tender Compliance — Mock Data Seeder")
    print("══════════════════════════════════════════════════\n")

    print("📌 Seeding GST Database...")
    create_all("gst-databases", GST_DATA)

    print("\n📌 Seeding PAN Database...")
    create_all("pan-databases", PAN_DATA)

    print("\n📌 Seeding Udyam Database...")
    create_all("udyam-databases", UDYAM_DATA)

    print("\n📌 Seeding EPFO Database...")
    create_all("epfo-databases", EPFO_DATA)

    print("\n📌 Seeding ESIC Database...")
    create_all("esic-databases", ESIC_DATA)

    print("\n📌 Seeding Startup India Database...")
    create_all("startup-india-databases", STARTUP_DATA)

    print("\n📌 Seeding NSIC Database...")
    create_all("nsic-databases", NSIC_DATA)

    print("\n📌 Seeding Blacklist Database...")
    create_all("blacklist-databases", BLACKLIST_DATA)

    print("\n📌 Seeding Tenders...")
    tender_ids = create_all("tenders", TENDER_DATA)

    print(f"\n📌 Seeding Bidder Applications (tender IDs: {tender_ids})...")
    seed_bidders(tender_ids)

    print("\n══════════════════════════════════════════════════")
    print("  ✅ Seeding complete!")
    print("  ⚠  Remember to PUBLISH all records in Strapi Admin")
    print("     → Content Manager → each type → Select All → Publish")
    print("══════════════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
