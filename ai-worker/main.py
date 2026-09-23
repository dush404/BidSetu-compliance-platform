"""
BidSetu Local AI Verification Worker — Document-First & Local-AI Only (Ollama / Qwen).
Zero external cloud AI dependencies.
"""

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
from dotenv import load_dotenv

from strapi_client import StrapiClientError, check_blacklist, fetch_gst_status, fetch_udyam_data
from verification_pipeline import run_verification, run_verification_async
from document_extractor import extract_text_from_pdf_bytes, query_local_qwen_for_extraction

# Load Environment
load_dotenv()

# AI Configuration: Local Ollama with Qwen only
AI_PROVIDER = "ollama"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

print(f"INFO: AI Provider: {AI_PROVIDER} | Ollama: {OLLAMA_URL} ({OLLAMA_MODEL})")

app = FastAPI(title="BidSetu Local AI Verification Worker", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
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
    bidder_id: str


class VerifyAllRequest(BaseModel):
    ids: List[str]


class SwitchProviderRequest(BaseModel):
    provider: str
    ollama_model: Optional[str] = None
    ollama_url: Optional[str] = None


# ── Core Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": "ollama",
        "ai_source": f"Ollama ({OLLAMA_MODEL})",
        "ollama_url": OLLAMA_URL,
        "ollama_model": OLLAMA_MODEL,
        "version": "1.0.0",
        "architecture": "DOCUMENT_FIRST_LOCAL_AI",
    }


@app.post("/switch-provider")
def switch_provider(req: SwitchProviderRequest):
    """Configure Local Ollama model / URL."""
    global OLLAMA_MODEL, OLLAMA_URL
    if req.ollama_model:
        OLLAMA_MODEL = req.ollama_model
    if req.ollama_url:
        OLLAMA_URL = req.ollama_url.rstrip("/")
    emit_log("SYSTEM", f"Local model set to {OLLAMA_MODEL} at {OLLAMA_URL}")
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
    """Extract structured data from an uploaded document using PyMuPDF and Local Qwen."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    content = await file.read()
    raw_text = extract_text_from_pdf_bytes(content) if file.filename.lower().endswith(".pdf") else content.decode("utf-8", errors="ignore")
    extracted_data = query_local_qwen_for_extraction(
        document_name=file.filename,
        raw_text=raw_text,
        ollama_url=OLLAMA_URL,
        ollama_model=OLLAMA_MODEL,
        log_fn=emit_log,
    )
    return {
        "filename": file.filename,
        "extracted_data": extracted_data,
        "source": f"Ollama ({OLLAMA_MODEL})",
    }


@app.post("/verify-bidder/{bidder_id}")
async def verify_single_bidder(bidder_id: str):
    """Run full document-first compliance verification for a single bidder."""
    try:
        result = run_verification(
            bidder_id,
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
    MAX_CONCURRENT = 2
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    tasks = [
        run_verification_async(
            bidder_id,
            semaphore,
            ollama_url=OLLAMA_URL,
            ollama_model=OLLAMA_MODEL,
            log_fn=emit_log,
        )
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
                "riskLevel": "Critical",
                "recommendation": "MANUAL_REVIEW",
            })
        else:
            output.append(result)
    return {
        "total": len(request.ids),
        "completed": len([r for r in output if "error" not in r]),
        "results": output,
    }