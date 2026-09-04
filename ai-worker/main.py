import json
import os
import asyncio
import threading
from collections import deque
from datetime import datetime, timezone
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Any
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

# AI Configuration (Supports Gemini or Local Ollama e.g. qwen3:14b)
AI_PROVIDER = os.getenv("AI_PROVIDER", "ollama" if not GEMINI_API_KEY else "auto").lower()
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:14b")

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

print(f"INFO: AI Provider: {AI_PROVIDER} | Ollama: {OLLAMA_URL} ({OLLAMA_MODEL}) | Gemini: {ACTIVE_MODEL_NAME}")

app = FastAPI(title="AI Tender Compliance Worker", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Log Event Bus ──────────────────────────────────────────────────────────────

LOG_MAX = 300
_log_deque: deque = deque(maxlen=LOG_MAX)
_log_lock = threading.Lock()
_sse_subscribers: List[asyncio.Queue] = []
_sse_lock = threading.Lock()


def emit_log(stage: str, msg: str, level: str = "INFO", data: Optional[dict] = None) -> None:
    """Append a structured log event and broadcast to all SSE subscribers."""
    event = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "stage": stage,
        "level": level,
        "msg": msg,
        "data": data or {},
    }
    with _log_lock:
        _log_deque.append(event)
    with _sse_lock:
        dead = []
        for q in _sse_subscribers:
            try:
                q.put_nowait(event)
            except Exception:
                dead.append(q)
        for q in dead:
            _sse_subscribers.remove(q)


# ── Request/Response models ────────────────────────────────────────────────────

class VerifyBidderRequest(BaseModel):
    bidder_id: int


class VerifyAllRequest(BaseModel):
    ids: List[int]


class SwitchProviderRequest(BaseModel):
    provider: str
    ollama_model: Optional[str] = None
    ollama_url: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def image_to_base64(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def extract_data_from_image(image_path: str) -> dict:
    if not model:
        raise HTTPException(status_code=503, detail="Gemini API not configured (Missing API Key)")
    try:
        prompt = (
            "You are an expert government document analyzer.\n"
            "Extract: Company Name, GSTIN, PAN, Udyam ID, Registration Date, Status.\n"
            "Return ONLY valid JSON. No markdown."
        )
        image_part = {"mime_type": "image/png", "data": image_to_base64(image_path)}
        response = model.generate_content([prompt, image_part])
        content = response.text.replace("```json", "").replace("```", "").strip()
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


# ── Core Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    if AI_PROVIDER == "ollama":
        source_label = f"Ollama ({OLLAMA_MODEL})"
    elif AI_PROVIDER == "gemini":
        source_label = f"Gemini ({ACTIVE_MODEL_NAME})"
    else:
        source_label = f"Gemini ({ACTIVE_MODEL_NAME})" if model else f"Ollama ({OLLAMA_MODEL})"
    return {
        "status": "ok",
        "provider": AI_PROVIDER,
        "ai_source": source_label,
        "ollama_url": OLLAMA_URL,
        "ollama_model": OLLAMA_MODEL,
        "version": "1.0.0",
    }


@app.post("/switch-provider")
def switch_provider(req: SwitchProviderRequest):
    """Dynamically switch AI provider between 'gemini', 'ollama', and 'auto'."""
    global AI_PROVIDER, OLLAMA_MODEL, OLLAMA_URL
    p = req.provider.lower()
    if p in ["gemini", "ollama", "auto"]:
        AI_PROVIDER = p
    if req.ollama_model:
        OLLAMA_MODEL = req.ollama_model
    if req.ollama_url:
        OLLAMA_URL = req.ollama_url.rstrip("/")
    emit_log("SYSTEM", f"Provider switched to {AI_PROVIDER} (model: {OLLAMA_MODEL})")
    return health()


# ── Log Stream Endpoints ───────────────────────────────────────────────────────

@app.get("/logs")
def get_logs(limit: int = 150):
    """Return the last N buffered log events as JSON."""
    with _log_lock:
        events = list(_log_deque)
    return {"events": events[-limit:], "total": len(events)}


@app.get("/log-stream")
async def log_stream():
    """Server-Sent Events stream — pushes new log events to the client in real-time."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=500)
    with _sse_lock:
        _sse_subscribers.append(queue)
    with _log_lock:
        boot_events = list(_log_deque)

    async def generator():
        try:
            for ev in boot_events:
                yield f"data: {json.dumps(ev)}\n\n"
            while True:
                try:
                    ev = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(ev)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            with _sse_lock:
                if queue in _sse_subscribers:
                    _sse_subscribers.remove(queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Verification Endpoints ─────────────────────────────────────────────────────

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
            "source": f"Gemini ({ACTIVE_MODEL_NAME})" if model else f"Ollama ({OLLAMA_MODEL})",
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/verify-bidder/{bidder_id}")
async def verify_single_bidder(bidder_id: str):
    """Run full compliance verification for a single bidder."""
    try:
        result = run_verification(
            bidder_id,
            model=model,
            ai_provider=AI_PROVIDER,
            ollama_url=OLLAMA_URL,
            ollama_model=OLLAMA_MODEL,
            log_fn=emit_log,
        )
        return result
    except Exception as exc:
        emit_log("ERROR", f"Verification failed for {bidder_id}: {exc}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/verify-all-bidders")
async def verify_all_bidders(request: VerifyAllRequest):
    """Run full compliance verification for multiple bidders concurrently."""
    if not request.ids:
        raise HTTPException(status_code=400, detail="No bidder IDs provided")
    MAX_CONCURRENT = 3
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    tasks = [
        run_verification_async(bidder_id, semaphore, model=model, log_fn=emit_log)
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
