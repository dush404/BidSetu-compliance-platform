import json
import os
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import base64
import google.generativeai as genai
from dotenv import load_dotenv
from strapi_client import StrapiClientError, check_blacklist, fetch_gst_status, fetch_udyam_data
from verification_pipeline import run_verification, run_verification_async

# Load Environment
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found. Add it to /ai-worker/.env")

# Initialize Gemini
model = None
ACTIVE_MODEL_NAME = "Not Configured"
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    for model_candidate in ["gemini-3.6-flash", "gemini-flash-latest", "gemini-flash-lite-latest"]:
        try:
            model = genai.GenerativeModel(model_candidate)
            ACTIVE_MODEL_NAME = model_candidate
            print(f"INFO: Successfully initialized Gemini model: {model_candidate}")
            break
        except Exception as e:
            print(f"WARNING: Could not initialize {model_candidate}: {e}")

app = FastAPI(title="AI Tender Compliance Worker", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response models ────────────────────────────────────────────────────

class VerifyBidderRequest(BaseModel):
    bidder_id: int


class VerifyAllRequest(BaseModel):
    ids: List[int]


# ── Helpers ────────────────────────────────────────────────────────────────────

def image_to_base64(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def extract_data_from_image(image_path: str) -> dict:
    if not model:
        raise HTTPException(status_code=503, detail="Gemini API not configured (Missing API Key)")

    try:
        prompt = """
You are an expert government document analyzer.
Extract the following fields from this image of a government certificate (GST, PAN, Udyam, etc.):
1. Company Name
2. GSTIN (if present)
3. PAN (if present)
4. Udyam ID (if present)
5. Registration Date
6. Status (Active, Cancelled, Expired, or Unknown)

Return ONLY a valid JSON object. Do not add markdown or explanations.
Example:
{
  "company_name": "ABC Pvt Ltd",
  "gstin": "27AABCU9603R1Z5",
  "pan": "AABCU9603R",
  "udyam_id": "UDYAM-...",
  "registration_date": "2023-01-01",
  "status": "Active"
}
"""
        image_part = {
            "mime_type": "image/png",
            "data": image_to_base64(image_path),
        }
        response = model.generate_content([prompt, image_part])
        content = response.text
        content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(content)

    except Exception as e:
        print(f"Gemini AI Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI Extraction failed: {str(e)}")


def quick_verify(extracted: dict) -> dict:
    """Legacy quick verify for the /extract endpoint."""
    gstin = extracted.get("gstin")
    pan = extracted.get("pan")
    try:
        gst_data = fetch_gst_status(gstin) if gstin else None
        udyam_data = fetch_udyam_data(extracted.get("udyam_id")) if extracted.get("udyam_id") else None
        blacklist_record = check_blacklist(gstin, pan)
    except StrapiClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    gst_status = (gst_data or {}).get("statusId") or (gst_data or {}).get("status")
    udyam_status = (udyam_data or {}).get("statusId") or (udyam_data or {}).get("status")
    is_blacklisted = blacklist_record is not None

    if is_blacklisted:
        score, risk = 0, "Critical"
    else:
        score = 100
        if gst_status == "Cancelled":
            score -= 50
        if udyam_status == "Expired":
            score -= 20
        risk = "Critical" if is_blacklisted else ("Low" if score >= 80 else "Medium" if score >= 50 else "High")

    details = {
        "gst_check": "Pass" if gst_status == "Active" else "Fail/Not Found",
        "pan_check": "Checked via blacklist" if pan else "Not Provided",
        "udyam_check": "Pass" if udyam_status == "Active" else "Fail/Not Found",
        "blacklist_check": "Fail" if is_blacklisted else "Pass",
    }
    matched_name = (gst_data or {}).get("legalName") or (udyam_data or {}).get("enterpriseName")
    return {
        "compliance_score": score,
        "risk_level": risk,
        "status": "Verified" if score >= 80 and not is_blacklisted else "Review Required",
        "details": details,
        "matched_bidder": matched_name,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "ai_source": "Gemini 1.5 Flash" if model else "Not Configured (Missing API Key)",
        "version": "1.0.0",
    }


@app.post("/extract")
async def extract_file(file: UploadFile = File(...)):
    """Extract structured data from an uploaded government document image."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        extracted_data = extract_data_from_image(temp_path)
        verification = quick_verify(extracted_data)
        return {
            "filename": file.filename,
            "extracted_data": extracted_data,
            "verification_result": verification,
            "source": "Gemini 1.5 Flash",
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/verify-bidder/{bidder_id}")
async def verify_single_bidder(bidder_id: str):
    """Run full compliance verification for a single bidder."""
    try:
        result = run_verification(bidder_id, model=model)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/verify-all-bidders")
async def verify_all_bidders(request: VerifyAllRequest):
    """
    Run full compliance verification for multiple bidders concurrently.
    Uses semaphore to limit concurrency and avoid overloading Strapi/Gemini.
    """
    if not request.ids:
        raise HTTPException(status_code=400, detail="No bidder IDs provided")

    MAX_CONCURRENT = 3  # Conservative limit for API rate limiting
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    tasks = [
        run_verification_async(bidder_id, semaphore, model=model)
        for bidder_id in request.ids
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    output = []
    for bidder_id, result in zip(request.ids, results):
        if isinstance(result, Exception):
            output.append({
                "bidderId": str(bidder_id),
                "error": str(result),
                "overallScore": 0,
                "riskLevel": "Unknown",
                "recommendation": "MANUAL_REVIEW",
            })
        else:
            output.append(result)

    return {
        "total": len(request.ids),
        "completed": len([r for r in output if "error" not in r]),
        "results": output,
    }


@app.get("/verify")
async def verify_legacy(gstin: str):
    """Legacy verification endpoint — kept for backward compatibility."""
    try:
        gst_data = fetch_gst_status(gstin)
        is_blacklisted = check_blacklist(gstin, None) is not None
    except StrapiClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    gst_status = (gst_data or {}).get("statusId") or "Not Found"
    score = 100 if gst_status == "Active" else 30
    risk = "Low" if score >= 80 else "High"

    return {
        "gstin": gstin,
        "company_name": (gst_data or {}).get("legalName", "Unknown"),
        "source": "GSTN (Simulated)",
        "compliance_score": score,
        "risk_level": risk,
        "status": "Verified" if score >= 80 else "Review Required",
        "details": {
            "gst_check": "Pass" if gst_status == "Active" else "Fail",
            "pan_check": "Not provided",
            "udyam_check": "Not provided",
        },
    }
