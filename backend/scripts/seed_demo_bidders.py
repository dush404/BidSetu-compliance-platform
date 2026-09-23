#!/usr/bin/env python3
"""
Seed script for BidSetu AI-Powered Bidder Verification Platform.
Generates 7 realistic statutory PDF certificates for each of the 3 demo bidders,
uploads them into Strapi Media Library, creates Tender TDR-2026-001,
attaches the documents to the 3 bidder applications, and populates simulated
central government registries (GST, PAN, Udyam, EPFO, ESIC, Blacklist).
"""

import os
import sys
import io
import json
import requests
import pymupdf as fitz
from typing import Any, Dict, List

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

STRAPI_URL = os.getenv("STRAPI_URL", "http://localhost:1337").rstrip("/")
API_TOKEN = os.getenv(
    "STRAPI_API_TOKEN",
    "0dc570202be092f7b0a30ce9f154aed05e1dfe231d26c98e90491bb81f83ca7f894a809abac5dd5519af189d576fad82f44d0f218c6e0b475954d97248ef00b4f82b4c0a28dfd1e0e8eebc8d0eaba47c492b15757dcabb19d8f3b269ea649c348e1546e21f509a170a3165cdb045c147b9ef89b05478d3a789500ed43d233ee3"
)

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json",
}

UPLOAD_HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
}


def strapi_get(endpoint: str, params: dict = None) -> list:
    url = f"{STRAPI_URL}/api/{endpoint}"
    resp = requests.get(url, headers=HEADERS, params=params or {}, timeout=15)
    if resp.ok:
        data = resp.json().get("data", [])
        return data if isinstance(data, list) else [data]
    return []


def strapi_post(endpoint: str, payload: dict) -> dict:
    url = f"{STRAPI_URL}/api/{endpoint}"
    resp = requests.post(url, headers=HEADERS, json={"data": payload}, timeout=15)
    if not resp.ok:
        print(f"  [ERROR] POST {endpoint}: {resp.status_code} - {resp.text[:200]}")
        return {}
    return resp.json().get("data", {})


def strapi_put(endpoint: str, doc_id: str, payload: dict) -> dict:
    url = f"{STRAPI_URL}/api/{endpoint}/{doc_id}"
    resp = requests.put(url, headers=HEADERS, json={"data": payload}, timeout=15)
    if not resp.ok:
        print(f"  [ERROR] PUT {endpoint}/{doc_id}: {resp.status_code} - {resp.text[:200]}")
        return {}
    return resp.json().get("data", {})


def upload_pdf(filename: str, pdf_bytes: bytes) -> dict:
    url = f"{STRAPI_URL}/api/upload"
    files = {"files": (filename, io.BytesIO(pdf_bytes), "application/pdf")}
    resp = requests.post(url, headers=UPLOAD_HEADERS, files=files, timeout=30)
    if resp.status_code in (200, 201):
        uploaded = resp.json()
        if isinstance(uploaded, list) and len(uploaded) > 0:
            return uploaded[0]
    print(f"  [ERROR] Upload {filename}: {resp.status_code} - {resp.text[:200]}")
    return {}


# ── PDF Generation Helper ───────────────────────────────────────────────────

def create_certificate_pdf(
    header_title: str,
    doc_title: str,
    subtitle: str,
    fields: List[tuple[str, str]],
    notes: List[str] = None,
    accent_color: tuple = (0.08, 0.22, 0.45), # Navy blue
) -> bytes:
    """Generate a clean, high-resolution statutory certificate PDF using PyMuPDF."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842) # Standard A4

    # Top banner
    page.draw_rect(fitz.Rect(0, 0, 595, 45), color=accent_color, fill=accent_color)
    page.insert_text((35, 28), header_title, fontsize=13, color=(1, 1, 1), fontname="helv")

    # Document Header Box
    page.draw_rect(fitz.Rect(30, 60, 565, 125), color=(0.85, 0.88, 0.92), fill=(0.96, 0.97, 0.99))
    page.insert_text((45, 88), doc_title, fontsize=15, color=accent_color, fontname="helv")
    page.insert_text((45, 110), subtitle, fontsize=10, color=(0.35, 0.35, 0.35), fontname="helv")

    # Separator
    page.draw_line((30, 135), (565, 135), color=(0.8, 0.8, 0.8), width=1)

    # Key-Value Table Box
    y = 160
    page.draw_rect(fitz.Rect(30, y - 10, 565, y + len(fields) * 28 + 10), color=(0.85, 0.85, 0.85), fill=(1, 1, 1))

    for idx, (label, val) in enumerate(fields):
        row_y = y + idx * 28
        # Alternating subtle row background
        if idx % 2 == 1:
            page.draw_rect(fitz.Rect(31, row_y - 8, 564, row_y + 20), color=(0.97, 0.98, 0.99), fill=(0.97, 0.98, 0.99))
        page.insert_text((45, row_y + 8), f"{label}:", fontsize=10, color=(0.25, 0.25, 0.25), fontname="helv")
        page.insert_text((210, row_y + 8), str(val), fontsize=10.5, color=(0.05, 0.05, 0.05), fontname="helv")
        page.draw_line((30, row_y + 20), (565, row_y + 20), color=(0.9, 0.9, 0.9), width=0.5)

    y = y + len(fields) * 28 + 30

    # Notes / Statutory declarations section
    if notes:
        page.draw_rect(fitz.Rect(30, y, 565, y + len(notes) * 20 + 25), color=(0.9, 0.92, 0.95), fill=(0.98, 0.98, 0.99))
        page.insert_text((45, y + 18), "STATUTORY DECLARATIONS & SYSTEM VERIFICATION:", fontsize=9.5, color=accent_color, fontname="helv")
        for n_idx, note in enumerate(notes):
            page.insert_text((45, y + 36 + n_idx * 18), f"•  {note}", fontsize=8.5, color=(0.3, 0.3, 0.3), fontname="helv")
        y += len(notes) * 20 + 45

    # Seal & Digital Signature
    page.draw_rect(fitz.Rect(360, 720, 565, 785), color=(0.8, 0.85, 0.9), fill=(0.95, 0.97, 1.0))
    page.insert_text((375, 738), "DIGITALLY SIGNED & VERIFIED", fontsize=8.5, color=accent_color, fontname="helv")
    page.insert_text((375, 755), "Certifying Authority: Govt. of India / MCA", fontsize=7.5, color=(0.3, 0.3, 0.3), fontname="helv")
    page.insert_text((375, 770), "Timestamp: 2026-02-15 11:42:09 IST", fontsize=7.5, color=(0.4, 0.4, 0.4), fontname="helv")

    # Bottom footer
    page.draw_line((30, 795), (565, 795), color=(0.8, 0.8, 0.8), width=0.5)
    page.insert_text((30, 812), "BidSetu Compliance Platform — Verified Statutory Record Copy", fontsize=8, color=(0.5, 0.5, 0.5), fontname="helv")
    page.insert_text((440, 812), "Authentic Verification Document", fontsize=8, color=(0.5, 0.5, 0.5), fontname="helv")

    return doc.tobytes()


# ── Bidder PDF Package Generators ───────────────────────────────────────────

def generate_apex_documents() -> Dict[str, bytes]:
    """Generate 7 documents for Apex Electricals (High Compliance / QUALIFY)"""
    docs = {}

    # 1. GST
    docs["Apex_GST_Certificate.pdf"] = create_certificate_pdf(
        "GOVERNMENT OF INDIA • GOODS AND SERVICES TAX",
        "FORM GST REG-06",
        "Registration Certificate issued under Central Goods and Services Tax Act, 2017",
        [
            ("Registration Number (GSTIN)", "27AAACA1234A1Z5"),
            ("Legal Name", "Apex Electricals & Power Infrastructure Pvt Ltd"),
            ("Trade Name", "Apex Electricals"),
            ("Constitution of Business", "Private Limited Company"),
            ("Address of Principal Place", "Plot 42, MIDC Industrial Area, Pune, Maharashtra 411018"),
            ("Date of Validity", "From 12/04/2018 to Continuing"),
            ("Type of Registration", "Regular Taxpayer"),
            ("Status", "Active"),
        ],
        [
            "This is a system-generated Certificate of Registration issued under CGST/SGST.",
            "Monthly GST returns (GSTR-3B & GSTR-1) filed up-to-date (last return: 2026-02-20).",
            "Compliance rating: 98% with zero notices pending under Section 73/74.",
        ]
    )

    # 2. PAN Card
    docs["Apex_PAN_Card.pdf"] = create_certificate_pdf(
        "INCOME TAX DEPARTMENT • GOVERNMENT OF INDIA",
        "PERMANENT ACCOUNT NUMBER CARD",
        "Form 49A Verification Record — Central Board of Direct Taxes",
        [
            ("Permanent Account Number (PAN)", "AAACA1234A"),
            ("Entity Name", "Apex Electricals & Power Infrastructure Pvt Ltd"),
            ("Date of Incorporation", "15/03/2018"),
            ("Category", "Company (Domestic)"),
            ("Jurisdiction AO", "CIT-Pune / Ward 3(1)"),
            ("Status", "Valid and Active"),
            ("Last ITR Filed", "AY 2025-26 (Filed 2025-09-30)"),
        ],
        [
            "PAN verified against Income Tax Database through NSDL / UTIITSL registry.",
            "All statutory tax audits under Section 44AB have been duly completed.",
        ]
    )

    # 3. Udyam Registration
    docs["Apex_Udyam_Registration.pdf"] = create_certificate_pdf(
        "MINISTRY OF MICRO, SMALL & MEDIUM ENTERPRISES",
        "UDYAM REGISTRATION CERTIFICATE",
        "Government of India Udyam Portal Verification",
        [
            ("Udyam Registration Number", "UDYAM-MH-12-0012345"),
            ("Name of Enterprise", "Apex Electricals & Power Infrastructure Pvt Ltd"),
            ("Type of Enterprise", "Medium Enterprise"),
            ("Major Activity", "Manufacturing of Electrical Equipment & Substation Switchgears"),
            ("NIC 2 Digit Code", "27 - Manufacture of electrical equipment"),
            ("Date of Incorporation", "15/03/2018"),
            ("Date of Udyam Registration", "15/07/2020"),
            ("Status", "Active"),
        ],
        [
            "MSME Classification verified based on Investment in Plant & Machinery and Turnover.",
            "Eligible for Public Procurement Policy benefits for MSEs / MSMEs.",
        ]
    )

    # 4. EPFO Challan
    docs["Apex_EPFO_Challan.pdf"] = create_certificate_pdf(
        "EMPLOYEES' PROVIDENT FUND ORGANISATION • INDIA",
        "ELECTRONIC CHALLAN CUM RECEIPT (ECR)",
        "Monthly Contribution Remittance Confirmation",
        [
            ("Establishment Code", "MH/BAN/0012345/000"),
            ("Establishment Name", "Apex Electricals & Power Infrastructure Pvt Ltd"),
            ("Wage Month", "January 2026"),
            ("Total Contributing Members", "85"),
            ("Total Remitted Amount", "₹ 4,82,450.00"),
            ("Challan TRRN", "1012602189452"),
            ("Payment Status", "Success / Paid on 15-02-2026"),
            ("Compliance Status", "Compliant"),
        ],
        [
            "EPF & MP Act, 1952 statutory dues deposited within stipulated due dates.",
            "Zero defaults or damages assessed under Section 14B.",
        ]
    )

    # 5. ESIC Return
    docs["Apex_ESIC_Return.pdf"] = create_certificate_pdf(
        "EMPLOYEES' STATE INSURANCE CORPORATION • INDIA",
        "ESIC MONTHLY CONTRIBUTION CHALLAN",
        "Social Security Statutory Compliance Document",
        [
            ("ESIC Registration Code", "31000123450001001"),
            ("Employer Name", "Apex Electricals & Power Infrastructure Pvt Ltd"),
            ("Contribution Period", "01/2026"),
            ("Insured Employees Count", "85"),
            ("Challan Reference Number", "0312610482910"),
            ("Payment Status", "Paid - Bank Confirmation Received"),
            ("Compliance Status", "Compliant"),
        ],
        [
            "All eligible employees covered under ESI Act, 1948 statutory benefits.",
        ]
    )

    # 6. Audited Financials
    docs["Apex_Annual_Turnover_Audited.pdf"] = create_certificate_pdf(
        "INSTITUTE OF CHARTERED ACCOUNTANTS OF INDIA",
        "AUDITED TURNOVER & FINANCIAL SOUNDNESS CERTIFICATE",
        "Issued by Statutory Auditors for Tender Participation",
        [
            ("Legal Entity", "Apex Electricals & Power Infrastructure Pvt Ltd"),
            ("Chartered Accountant", "M/s R. K. Agrawal & Associates (FRN: 114522W)"),
            ("Unique Doc ID Number (UDIN)", "26045892AAAA1234"),
            ("FY 2024-25 Turnover", "₹ 18,45,00,000.00"),
            ("FY 2023-24 Turnover", "₹ 15,20,00,000.00"),
            ("FY 2022-23 Turnover", "₹ 13,80,00,000.00"),
            ("Audited Net Worth", "₹ 8,90,00,000.00 (Positive)"),
            ("Working Capital Available", "₹ 4,20,00,000.00"),
        ],
        [
            "The bidder meets all financial criteria specified in the tender document.",
            "Net worth is positive and bidder has adequate credit lines from scheduled banks.",
        ]
    )

    # 7. Non-Blacklisting Affidavit
    docs["Apex_Non_Blacklisting_Affidavit.pdf"] = create_certificate_pdf(
        "NOTARY PUBLIC • GOVERNMENT OF MAHARASHTRA",
        "AFFIDAVIT ON NON-BLACKLISTING & DEBARMENT",
        "Solemn Affirmation on Non-Judicial Stamp Paper",
        [
            ("Deponent Entity", "Apex Electricals & Power Infrastructure Pvt Ltd"),
            ("Authorized Signatory", "Mr. Rajesh Sharma, Managing Director"),
            ("Notary Registration No", "NOT-MH-8924"),
            ("Affidavit Affirmation", "Entity is NEVER debarred, suspended, or blacklisted"),
            ("Covered Authorities", "GeM, Central Govt Ministries, State PSUs, CPWD"),
            ("Litigation Status", "No criminal proceedings or vigilance inquiries pending"),
            ("Date of Execution", "05-02-2026"),
        ],
        [
            "Duly sworn before Notary Public under oath in accordance with Indian Oaths Act.",
            "Deponent confirms that all statements submitted are true and verifiable.",
        ]
    )

    return docs


def generate_nova_documents() -> Dict[str, bytes]:
    """Generate 7 documents for Nova Energy (Medium Compliance / MANUAL_REVIEW due to ESIC mismatch)"""
    docs = {}

    # 1. GST
    docs["Nova_GST_Certificate.pdf"] = create_certificate_pdf(
        "GOVERNMENT OF INDIA • GOODS AND SERVICES TAX",
        "FORM GST REG-06",
        "Registration Certificate issued under CGST/SGST",
        [
            ("Registration Number (GSTIN)", "07AABCN5678B1Z2"),
            ("Legal Name", "Nova Energy & Engineering Systems LLP"),
            ("Trade Name", "Nova Energy"),
            ("Constitution of Business", "Limited Liability Partnership"),
            ("Address of Principal Place", "A-18, Okhla Industrial Area Phase II, New Delhi 110020"),
            ("Date of Validity", "From 20/09/2020 to Continuing"),
            ("Type of Registration", "Regular Taxpayer"),
            ("Status", "Active"),
        ],
        [
            "GSTR-3B filings regular up to January 2026.",
            "Registered in NCT of Delhi.",
        ]
    )

    # 2. PAN Card
    docs["Nova_PAN_Card.pdf"] = create_certificate_pdf(
        "INCOME TAX DEPARTMENT • GOVERNMENT OF INDIA",
        "PERMANENT ACCOUNT NUMBER CARD",
        "Form 49A Verification Record — Central Board of Direct Taxes",
        [
            ("Permanent Account Number (PAN)", "AABCN5678B"),
            ("Entity Name", "Nova Energy & Engineering Systems LLP"),
            ("Date of Incorporation", "10/08/2020"),
            ("Category", "Limited Liability Partnership"),
            ("Status", "Valid and Active"),
            ("Last ITR Filed", "AY 2025-26 (Filed 2025-08-25)"),
        ],
        [
            "PAN active and seeded with Aadhaar/Partnership Deed records.",
        ]
    )

    # 3. Udyam Registration
    docs["Nova_Udyam_Registration.pdf"] = create_certificate_pdf(
        "MINISTRY OF MICRO, SMALL & MEDIUM ENTERPRISES",
        "UDYAM REGISTRATION CERTIFICATE",
        "Government of India Udyam Portal Verification",
        [
            ("Udyam Registration Number", "UDYAM-DL-05-0056789"),
            ("Name of Enterprise", "Nova Energy & Engineering Systems LLP"),
            ("Type of Enterprise", "Small Enterprise"),
            ("Major Activity", "Manufacturing & Electrical Engineering Services"),
            ("NIC 2 Digit Code", "27 - Manufacture of electrical equipment"),
            ("Date of Registration", "22/03/2021"),
            ("Status", "Active"),
        ],
        [
            "Small enterprise classification verified.",
        ]
    )

    # 4. EPFO Challan
    docs["Nova_EPFO_Challan.pdf"] = create_certificate_pdf(
        "EMPLOYEES' PROVIDENT FUND ORGANISATION • INDIA",
        "ELECTRONIC CHALLAN CUM RECEIPT (ECR)",
        "Monthly Contribution Remittance Confirmation",
        [
            ("Establishment Code", "DL/CPM/0056789/000"),
            ("Establishment Name", "Nova Energy & Engineering Systems LLP"),
            ("Wage Month", "January 2026"),
            ("Total Contributing Members", "28"),
            ("Payment Status", "Paid - Regular Remittance"),
            ("Compliance Status", "Compliant"),
        ],
        [
            "EPFO dues deposited in timely manner.",
        ]
    )

    # 5. ESIC Return (Contains code 11000567890001002 while registry has 11000567890009999)
    docs["Nova_ESIC_Return.pdf"] = create_certificate_pdf(
        "EMPLOYEES' STATE INSURANCE CORPORATION • INDIA",
        "ESIC MONTHLY CONTRIBUTION CHALLAN",
        "Social Security Statutory Compliance Document",
        [
            ("ESIC Registration Code", "11000567890001002"),
            ("Employer Name", "Nova Energy & Engineering Systems LLP"),
            ("Contribution Period", "01/2026"),
            ("Insured Employees Count", "28"),
            ("Branch Office", "Okhla Branch Sub-Regional Office"),
            ("Payment Status", "Paid"),
        ],
        [
            "Notice: Regional branch code migrated during recent ESIC system restructuring.",
            "Physical verification of regional branch sub-code recommended.",
        ],
        accent_color=(0.55, 0.35, 0.05) # Amber hint
    )

    # 6. Audited Financials
    docs["Nova_Audited_Financials.pdf"] = create_certificate_pdf(
        "INSTITUTE OF CHARTERED ACCOUNTANTS OF INDIA",
        "AUDITED TURNOVER CERTIFICATE",
        "Financial Certification for Tender Eligibility",
        [
            ("Legal Entity", "Nova Energy & Engineering Systems LLP"),
            ("Chartered Accountant", "S. P. Mehra & Co."),
            ("Unique Doc ID Number (UDIN)", "26078945BBBB5678"),
            ("FY 2024-25 Turnover", "₹ 6,25,00,000.00"),
            ("FY 2023-24 Turnover", "₹ 5,10,00,000.00"),
            ("Audited Net Worth", "₹ 2,40,00,000.00 (Positive)"),
        ],
        [
            "Turnover meets requirement of ₹ 4.5 Cr specified in tender.",
        ]
    )

    # 7. Non-Blacklisting Affidavit
    docs["Nova_Non_Blacklisting_Affidavit.pdf"] = create_certificate_pdf(
        "NOTARY PUBLIC • NCT OF DELHI",
        "AFFIDAVIT ON NON-BLACKLISTING & NON-DEBARMENT",
        "Solemn Declaration on Non-Judicial E-Stamp",
        [
            ("Deponent Entity", "Nova Energy & Engineering Systems LLP"),
            ("Designated Partner", "Mr. Amit Verma"),
            ("Affidavit Statement", "Deponent is not blacklisted by any procuring entity"),
            ("Date of Execution", "10-02-2026"),
        ],
        [
            "Clean record on Central Vigilance Commission register.",
        ]
    )

    return docs


def generate_vanguard_documents() -> Dict[str, bytes]:
    """Generate 7 documents for Vanguard Infra (Low Compliance / DISQUALIFY - Cancelled GST & Blacklist)"""
    docs = {}

    # 1. GST (Claimed active on 2019, but database has CANCELLED)
    docs["Vanguard_GST_Certificate.pdf"] = create_certificate_pdf(
        "GOVERNMENT OF INDIA • GOODS AND SERVICES TAX",
        "FORM GST REG-06",
        "Registration Certificate",
        [
            ("Registration Number (GSTIN)", "06AABCV9999C1Z8"),
            ("Legal Name", "Vanguard Infra Projects Pvt Ltd"),
            ("Trade Name", "Vanguard Infra"),
            ("Constitution of Business", "Private Limited Company"),
            ("Address of Principal Place", "Sector 18, Gurugram, Haryana 122015"),
            ("Original Date of Grant", "14/06/2019"),
            ("Type of Registration", "Regular Taxpayer"),
            ("Status Stated on Document", "Active (Certificate dated 2019)"),
        ],
        [
            "Document indicates registration issued in 2019.",
            "Warning: Online GST portal reflects Cancellation under Section 29 due to non-filing.",
        ],
        accent_color=(0.55, 0.1, 0.1) # Crimson red
    )

    # 2. PAN Card
    docs["Vanguard_PAN_Card.pdf"] = create_certificate_pdf(
        "INCOME TAX DEPARTMENT • GOVERNMENT OF INDIA",
        "PERMANENT ACCOUNT NUMBER CARD",
        "Form 49A Verification Record",
        [
            ("Permanent Account Number (PAN)", "AABCV9999C"),
            ("Entity Name", "Vanguard Infra Projects Pvt Ltd"),
            ("Category", "Company"),
            ("Last ITR Filed", "AY 2024-25 (Delinquent AY 2025-26)"),
        ],
        [
            "PAN issued by Income Tax Department.",
        ]
    )

    # 3. Udyam Registration
    docs["Vanguard_Udyam_Registration.pdf"] = create_certificate_pdf(
        "MINISTRY OF MICRO, SMALL & MEDIUM ENTERPRISES",
        "UDYAM REGISTRATION CERTIFICATE",
        "MSME Registration Copy",
        [
            ("Udyam Registration Number", "UDYAM-HR-03-0099999"),
            ("Name of Enterprise", "Vanguard Infra Projects Pvt Ltd"),
            ("Type of Enterprise", "Medium Enterprise"),
            ("Date of Registration", "10/11/2019"),
        ],
        [
            "Expired registration record. Not re-validated on Udyam Assist portal.",
        ]
    )

    # 4. EPFO Challan
    docs["Vanguard_EPFO_Challan.pdf"] = create_certificate_pdf(
        "EMPLOYEES' PROVIDENT FUND ORGANISATION • INDIA",
        "ELECTRONIC CHALLAN CUM RECEIPT (ECR)",
        "Monthly Contribution Remittance Record",
        [
            ("Establishment Code", "HR/GUR/0099999/000"),
            ("Establishment Name", "Vanguard Infra Projects Pvt Ltd"),
            ("Status", "Defaulter / Pending Demand Notices"),
            ("Damages Under Section 14B", "Outstanding ₹ 14,20,00,000.00"),
        ],
        [
            "Establishment is under scrutiny for non-remittance of statutory EPF contributions.",
        ]
    )

    # 5. Income Tax Return
    docs["Vanguard_Income_Tax_Return.pdf"] = create_certificate_pdf(
        "INCOME TAX DEPARTMENT • INDIA",
        "INDIAN INCOME TAX RETURN ACKNOWLEDGEMENT (ITR-V)",
        "Assessment Year 2024-25 Acknowledgement",
        [
            ("PAN", "AABCV9999C"),
            ("Name", "Vanguard Infra Projects Pvt Ltd"),
            ("Form Filed", "ITR-6"),
            ("Gross Total Income", "₹ 21,40,000.00"),
        ],
        [
            "ITR filed with substantial delay.",
        ]
    )

    # 6. Turnover Statement
    docs["Vanguard_Turnover_Statement.pdf"] = create_certificate_pdf(
        "VANGUARD INFRA PROJECTS PVT LTD",
        "SELF-DECLARED ANNUAL TURNOVER STATEMENT",
        "Financial Statement Submitted for Prequalification",
        [
            ("Entity", "Vanguard Infra Projects Pvt Ltd"),
            ("FY 2024-25 Declared Turnover", "₹ 2,10,00,000.00"),
            ("Deficit against Tender Minimum", "₹ 2,40,00,000.00 (Below required ₹ 4.5 Cr)"),
            ("Working Capital Status", "Constrained / Negative"),
        ],
        [
            "Un-audited provisional statement. Fails minimum financial turnover requirement.",
        ]
    )

    # 7. Debarment Declaration (Claiming clean, but Blacklist registry has ACTIVE BAN)
    docs["Vanguard_Debarment_Declaration.pdf"] = create_certificate_pdf(
        "VANGUARD INFRA PROJECTS PVT LTD",
        "DECLARATION OF NON-DEBARMENT",
        "Bidder Prequalification Self-Declaration",
        [
            ("Company Name", "Vanguard Infra Projects Pvt Ltd"),
            ("Signatory", "Sanjay Kapoor, Director"),
            ("Self Declaration", "Bidder claims not to be blacklisted by any Government agency"),
        ],
        [
            "CRITICAL FLAG: Government Debarment Database lists Vanguard Infra Projects Pvt Ltd",
            "as DEBARRED for 3 years (2025-01-10 to 2028-01-09) by Ministry of Power for fraudulent bidding.",
            "This self-declaration is in direct contradiction with Central Blacklist records.",
        ],
        accent_color=(0.6, 0.05, 0.05)
    )

    return docs


# ── Database Seeding ────────────────────────────────────────────────────────

def seed_registries():
    print("\n[1/4] Seeding simulated government databases...")

    # 1. GST Database
    gst_items = [
        {"gstin": "27AAACA1234A1Z5", "legalName": "Apex Electricals & Power Infrastructure Pvt Ltd", "tradeName": "Apex Electricals", "statusId": "Active", "lastReturnFiled": "2026-08-20", "textComplianceRating": 98},
        {"gstin": "07AABCN5678B1Z2", "legalName": "Nova Energy & Engineering Systems LLP", "tradeName": "Nova Energy", "statusId": "Active", "lastReturnFiled": "2026-08-15", "textComplianceRating": 85},
        {"gstin": "06AABCV9999C1Z8", "legalName": "Vanguard Infra Projects Pvt Ltd", "tradeName": "Vanguard Infra", "statusId": "Cancelled", "lastReturnFiled": "2023-08-10", "textComplianceRating": 15},
    ]
    for item in gst_items:
        existing = strapi_get("gst-databases", {"filters[gstin][$eq]": item["gstin"]})
        if not existing:
            created = strapi_post("gst-databases", item)
            print(f"  ✓ GST: {item['gstin']} created")
        else:
            doc_id = existing[0].get("documentId")
            if doc_id:
                strapi_put("gst-databases", doc_id, item)
            print(f"  ✓ GST: {item['gstin']} updated")

    # 2. PAN Database
    pan_items = [
        {"panNumber": "AAACA1234A", "holderName": "Apex Electricals & Power Infrastructure Pvt Ltd", "statusId": "Valid", "lastItrFiled": "2025-09-30"},
        {"panNumber": "AABCN5678B", "holderName": "Nova Energy & Engineering Systems LLP", "statusId": "Valid", "lastItrFiled": "2025-08-25"},
        {"panNumber": "AABCV9999C", "holderName": "Vanguard Infra Projects Pvt Ltd", "statusId": "Valid", "lastItrFiled": "2024-07-15"},
    ]
    for item in pan_items:
        existing = strapi_get("pan-databases", {"filters[panNumber][$eq]": item["panNumber"]})
        if not existing:
            created = strapi_post("pan-databases", item)
            print(f"  ✓ PAN: {item['panNumber']} created")
        else:
            doc_id = existing[0].get("documentId")
            if doc_id:
                strapi_put("pan-databases", doc_id, item)
            print(f"  ✓ PAN: {item['panNumber']} updated")

    # 3. Udyam Database
    udyam_items = [
        {"udyamNumber": "UDYAM-MH-12-0012345", "enterpriseName": "Apex Electricals & Power Infrastructure Pvt Ltd", "catagory": "Medium", "statusId": "Active", "registrationDate": "2020-07-15"},
        {"udyamNumber": "UDYAM-DL-05-0056789", "enterpriseName": "Nova Energy & Engineering Systems LLP", "catagory": "Small", "statusId": "Active", "registrationDate": "2021-03-22"},
        {"udyamNumber": "UDYAM-HR-03-0099999", "enterpriseName": "Vanguard Infra Projects Pvt Ltd", "catagory": "Medium", "statusId": "Expired", "registrationDate": "2019-11-10"},
    ]
    for item in udyam_items:
        existing = strapi_get("udyam-databases", {"filters[udyamNumber][$eq]": item["udyamNumber"]})
        if not existing:
            created = strapi_post("udyam-databases", item)
            print(f"  ✓ Udyam: {item['udyamNumber']} created")
        else:
            doc_id = existing[0].get("documentId")
            if doc_id:
                strapi_put("udyam-databases", doc_id, item)
            print(f"  ✓ Udyam: {item['udyamNumber']} updated")

    # 4. EPFO Database
    epfo_items = [
        {"establishmentCode": "MH/BAN/0012345/000", "establishmentName": "Apex Electricals & Power Infrastructure Pvt Ltd", "status": "Compliant", "lastComplianceDate": "2026-02-15", "employeeCount": 85},
        {"establishmentCode": "DL/CPM/0056789/000", "establishmentName": "Nova Energy & Engineering Systems LLP", "status": "Compliant", "lastComplianceDate": "2026-02-10", "employeeCount": 28},
        {"establishmentCode": "HR/GUR/0099999/000", "establishmentName": "Vanguard Infra Projects Pvt Ltd", "status": "Defaulter", "lastComplianceDate": "2024-01-10", "employeeCount": 12},
    ]
    for item in epfo_items:
        existing = strapi_get("epfo-databases", {"filters[establishmentCode][$eq]": item["establishmentCode"]})
        if not existing:
            created = strapi_post("epfo-databases", item)
            print(f"  ✓ EPFO: {item['establishmentCode']} created")
        else:
            doc_id = existing[0].get("documentId")
            if doc_id:
                strapi_put("epfo-databases", doc_id, item)
            print(f"  ✓ EPFO: {item['establishmentCode']} updated")

    # 5. ESIC Database
    esic_items = [
        {"esicCode": "31000123450001001", "establishmentName": "Apex Electricals & Power Infrastructure Pvt Ltd", "status": "Compliant", "lastComplianceDate": "2026-02-15"},
        {"esicCode": "11000567890009999", "establishmentName": "Nova Energy & Engineering Systems LLP (Branch)", "status": "Non-Compliant", "lastComplianceDate": "2025-06-15"},
    ]
    for item in esic_items:
        existing = strapi_get("esic-databases", {"filters[esicCode][$eq]": item["esicCode"]})
        if not existing:
            created = strapi_post("esic-databases", item)
            print(f"  ✓ ESIC: {item['esicCode']} created")
        else:
            doc_id = existing[0].get("documentId")
            if doc_id:
                strapi_put("esic-databases", doc_id, item)
            print(f"  ✓ ESIC: {item['esicCode']} updated")

    # 6. Blacklist Database
    blacklist_items = [
        {
            "entityName": "Vanguard Infra Projects Pvt Ltd",
            "gstin": "06AABCV9999C1Z8",
            "pan": "AABCV9999C",
            "reason": "Debarred for fraudulent tender submission and document manipulation - 3 Year Ban",
            "debarredUntil": "2028-01-09",
        }
    ]
    for item in blacklist_items:
        existing = strapi_get("blacklist-databases", {"filters[gstin][$eq]": item["gstin"]})
        if not existing:
            created = strapi_post("blacklist-databases", item)
            print(f"  ✓ Blacklist: {item['entityName']} created")
        else:
            doc_id = existing[0].get("documentId")
            if doc_id:
                strapi_put("blacklist-databases", doc_id, item)
            print(f"  ✓ Blacklist: {item['entityName']} updated")


def seed_tender() -> dict:
    print("\n[2/4] Ensuring Tender TDR-2026-001 exists in Strapi...")
    tender_data = {
        "tenderId": "TDR-2026-001",
        "title": "Supply, Testing and Commissioning of 33/11kV Electrical Substation Equipment",
        "description": "Turnkey procurement for 33/11kV power transformers, SF6 switchgears, SCADA automation panels, and statutory commissioning for state transmission substations.",
        "department": "State Electricity Transmission Corporation",
        "statusId": "Open",
        "bidderCount": 3,
        "publishedDate": "2026-03-01T09:00:00.000Z",
        "closingDate": "2026-04-15T18:00:00.000Z",
    }
    existing = strapi_get("tenders", {"filters[tenderId][$eq]": "TDR-2026-001"})
    if existing:
        tender_rec = existing[0]
        print(f"  ✓ Found existing Tender TDR-2026-001 (ID: {tender_rec.get('id')})")
        return tender_rec

    created = strapi_post("tenders", tender_data)
    print(f"  ✓ Created Tender TDR-2026-001 (ID: {created.get('id')})")
    return created


def seed_bidder_packages(tender_id: int):
    print("\n[3/4] Generating statutory PDFs and uploading to Strapi Media Library...")

    bidders_spec = [
        {
            "name": "Apex Electricals & Power Infrastructure Pvt Ltd",
            "company": "Apex Electricals & Power Infrastructure Pvt Ltd",
            "gen_fn": generate_apex_documents,
            "expected": "QUALIFY (~95 score)",
        },
        {
            "name": "Nova Energy & Engineering Systems LLP",
            "company": "Nova Energy & Engineering Systems LLP",
            "gen_fn": generate_nova_documents,
            "expected": "MANUAL_REVIEW (ESIC discrepancy)",
        },
        {
            "name": "Vanguard Infra Projects Pvt Ltd",
            "company": "Vanguard Infra Projects Pvt Ltd",
            "gen_fn": generate_vanguard_documents,
            "expected": "DISQUALIFY (Cancelled GST + Blacklisted)",
        },
    ]

    for b_idx, b_spec in enumerate(bidders_spec, start=1):
        print(f"\n  Generating document package for Bidder {b_idx}: {b_spec['name']}")
        pdf_dict = b_spec["gen_fn"]()
        media_ids = []

        for filename, pdf_data in pdf_dict.items():
            print(f"    • Generating & uploading {filename} ({len(pdf_data)} bytes)...")
            uploaded = upload_pdf(filename, pdf_data)
            if uploaded and "id" in uploaded:
                media_ids.append(uploaded["id"])
            else:
                print(f"      [WARNING] Could not upload {filename}")

        print(f"  Uploaded {len(media_ids)} / 7 documents for {b_spec['name']}")

        # Look up existing bidder-application or create new
        existing_bidders = strapi_get(
            "bidder-applications",
            {"filters[companyName][$eq]": b_spec["company"], "populate": "*"}
        )
        if not existing_bidders:
            existing_bidders = strapi_get(
                "bidder-applications",
                {"filters[bidderName][$eq]": b_spec["name"], "populate": "*"}
            )

        bidder_payload = {
            "bidderName": b_spec["name"],
            "companyName": b_spec["company"],
            "tender": tender_id,
            "documents": media_ids,
            "verificationStatus": "Pending",
            "complianceScore": None,
            "riskLevel": None,
            "aiRecommendation": None,
            "verificationResult": None,
            "extractedData": None,
            "lastVerifiedAt": None,
            # Blank out manual statutory numbers so document-first pipeline extracts them:
            "gstin": "",
            "panNumber": "",
            "udyamId": "",
            "epfoCode": "",
            "esicCode": "",
            "dpiitNumber": "",
            "nsicNumber": "",
        }

        if existing_bidders:
            b_rec = existing_bidders[0]
            doc_id = b_rec.get("documentId")
            num_id = b_rec.get("id")
            print(f"  Updating existing Bidder Application (ID: {num_id}, DocID: {doc_id})...")
            strapi_put("bidder-applications", doc_id, bidder_payload)
            print(f"  ✓ Bidder {b_spec['name']} reset to Pending with {len(media_ids)} attached PDFs")
        else:
            created = strapi_post("bidder-applications", bidder_payload)
            print(f"  ✓ Bidder {b_spec['name']} created (ID: {created.get('id')}) with {len(media_ids)} attached PDFs")


def main():
    print("=" * 70)
    print("BidSetu: Synthetic Demo Bidders & Document Seed Script")
    print("=" * 70)
    print(f"Strapi URL: {STRAPI_URL}")

    # Step 1: Registries
    seed_registries()

    # Step 2: Tender
    tender = seed_tender()
    tender_id = tender.get("id")
    if not tender_id:
        print("[FATAL] Could not get tender ID")
        sys.exit(1)

    # Step 3: Generate & upload PDFs, create Bidders
    seed_bidder_packages(tender_id)

    print("\n" + "=" * 70)
    print("✓ SEED COMPLETED SUCCESSFULLY!")
    print("3 Demo Bidders created with full 7-document PDF packages attached:")
    print("  1. Apex Electricals & Power Infrastructure Pvt Ltd -> Pending (Target: QUALIFY)")
    print("  2. Nova Energy & Engineering Systems LLP -> Pending (Target: MANUAL_REVIEW)")
    print("  3. Vanguard Infra Projects Pvt Ltd -> Pending (Target: DISQUALIFY)")
    print("=" * 70)


if __name__ == "__main__":
    main()
