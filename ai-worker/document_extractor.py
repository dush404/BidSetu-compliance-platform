"""
Document text extraction and structured parsing using PyMuPDF and Local Qwen (Ollama).
Zero cloud LLM dependency — all processing is local.
"""

import io
import json
import os
import re
from typing import Any, Dict, List, Optional
import requests
import fitz  # PyMuPDF


# Regex patterns for standard Indian statutory/compliance credentials
PATTERNS = {
    "gstin": re.compile(r"\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b"),
    "panNumber": re.compile(r"\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b"),
    "udyamNumber": re.compile(r"\b(UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7})\b", re.IGNORECASE),
    "epfoCode": re.compile(r"\b([A-Z]{2}/[A-Z]{3}/[0-9]{7}/[0-9]{3})\b"),
    "esicCode": re.compile(r"\b([0-9]{17})\b"),
    "dpiitNumber": re.compile(r"\b(DIPP[0-9]{4,7})\b", re.IGNORECASE),
    "nsicNumber": re.compile(r"\b(NSIC/[A-Z0-9/_-]+)\b", re.IGNORECASE),
}


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extract all text from PDF bytes using PyMuPDF."""
    text_content = []
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page_num in range(len(doc)):
                page = doc[page_num]
                text_content.append(page.get_text("text"))
    except Exception as exc:
        print(f"[PyMuPDF] Error parsing PDF bytes: {exc}")
    return "\n".join(text_content).strip()


def query_local_qwen_for_extraction(
    document_name: str,
    raw_text: str,
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "qwen2.5:7b",
    log_fn=None,
) -> Dict[str, Any]:
    """
    Send document text to local Qwen via Ollama to extract structured credentials as JSON.
    """
    prompt = f"""You are a precise document extraction AI for government procurement compliance verification.
Analyze the following document text from file '{document_name}' and extract the statutory credentials.

Return ONLY a valid, raw JSON object (no markdown formatting, no explanation, no backticks):
{{
  "documentType": "PAN Certificate | GST Certificate | Udyam Registration | EPFO Certificate | ESIC Certificate | DPIIT Certificate | NSIC Certificate | Other",
  "legalName": "Company or entity legal name, or null",
  "gstin": "15-digit GSTIN if found, or null",
  "panNumber": "10-character PAN if found, or null",
  "udyamNumber": "Udyam registration number if found, or null",
  "epfoCode": "EPFO establishment code if found, or null",
  "esicCode": "17-digit ESIC code if found, or null",
  "dpiitNumber": "DPIIT recognition number if found, or null",
  "nsicNumber": "NSIC registration number if found, or null",
  "status": "Active | Valid | Cancelled | Expired | Suspended | null"
}}

Document Text:
{raw_text[:3000]}"""

    if log_fn:
        log_fn("AI:QWEN_EXTRACT", f"Extracting structured data from {document_name} via {ollama_model}…")

    try:
        url = f"{ollama_url.rstrip('/')}/api/generate"
        payload = {
            "model": ollama_model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.1},
        }
        res = requests.post(url, json=payload, timeout=60)
        if res.status_code == 200:
            raw_response = res.json().get("response", "").strip()
            # Clean thinking tags or stray markdown
            clean = re.sub(r"<think>.*?</think>", "", raw_response, flags=re.DOTALL).strip()
            clean = re.sub(r"^```json\s*", "", clean)
            clean = re.sub(r"\s*```$", "", clean)
            match = re.search(r"\{.*\}", clean, flags=re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                if log_fn:
                    log_fn(
                        "AI:QWEN_EXTRACT",
                        f"Qwen successfully parsed {document_name} ({data.get('documentType', 'Document')})",
                        data={"documentType": data.get("documentType")},
                    )
                return data
    except Exception as exc:
        if log_fn:
            log_fn("AI:QWEN_EXTRACT", f"Qwen extraction notice for {document_name}: {exc}", level="WARN")
        print(f"[Qwen Extract] Ollama request failed or returned invalid JSON: {exc}")

    return {}


def regex_fallback_extraction(raw_text: str, document_name: str) -> Dict[str, Any]:
    """Deterministic regex extraction to guarantee no field is lost."""
    extracted = {}
    for key, pattern in PATTERNS.items():
        match = pattern.search(raw_text)
        if match:
            extracted[key] = match.group(1).strip()

    # Determine document type heuristic from filename and text
    lower = (document_name + " " + raw_text).lower()
    doc_type = "Supporting Document"
    if "pan" in lower:
        doc_type = "PAN Certificate"
    elif "gst" in lower:
        doc_type = "GST Certificate"
    elif "udyam" in lower or "msme" in lower:
        doc_type = "Udyam Registration"
    elif "epfo" in lower or "provident" in lower:
        doc_type = "EPFO Certificate"
    elif "esic" in lower or "insurance" in lower:
        doc_type = "ESIC Certificate"
    elif "dpiit" in lower or "startup" in lower:
        doc_type = "DPIIT Certificate"
    elif "nsic" in lower:
        doc_type = "NSIC Certificate"

    extracted["documentType"] = doc_type
    return extracted


def fetch_document_bytes(doc: Dict[str, Any], strapi_url: str) -> Optional[bytes]:
    """Fetch binary content of a document from Strapi or local uploads directory."""
    url = doc.get("url")
    if not url:
        return None

    # 1. Try local filesystem if path points to uploads
    filename = os.path.basename(url)
    candidate_paths = [
        os.path.join(os.getcwd(), "backend", "public", "uploads", filename),
        os.path.join("/opt/app/public/uploads", filename),
        os.path.join(os.path.dirname(os.getcwd()), "backend", "public", "uploads", filename),
    ]
    for p in candidate_paths:
        if os.path.isfile(p):
            try:
                with open(p, "rb") as f:
                    return f.read()
            except Exception:
                pass

    # 2. Fetch via HTTP from Strapi
    full_url = f"{strapi_url.rstrip('/')}{url}" if url.startswith("/") else url
    try:
        resp = requests.get(full_url, timeout=15)
        if resp.status_code == 200:
            return resp.content
    except Exception as exc:
        print(f"[DocumentFetcher] Failed to fetch {full_url}: {exc}")

    return None


def process_bidder_documents(
    documents: List[Dict[str, Any]],
    strapi_url: str,
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "qwen2.5:7b",
    log_fn=None,
) -> Dict[str, Any]:
    """
    Full document-first processing pipeline:
    Iterates through all attached documents, extracts text with PyMuPDF,
    extracts structured fields with Local Qwen + deterministic regex fallback,
    and builds an aggregated, traceable extractedData dictionary.
    """
    aggregated: Dict[str, Any] = {
        "companyName": None,
        "gstin": None,
        "panNumber": None,
        "udyamId": None,
        "epfoCode": None,
        "esicCode": None,
        "dpiitNumber": None,
        "nsicNumber": None,
        "traceability": {},
        "documentsProcessed": [],
    }

    if log_fn:
        log_fn("DOC:START", f"Starting document extraction for {len(documents)} attached file(s)…")

    for doc in documents:
        doc_name = doc.get("name") or doc.get("caption") or "Document"
        doc_id = str(doc.get("id") or doc.get("documentId") or "")

        if log_fn:
            log_fn("DOC:READ", f"Loading document: {doc_name}…")

        pdf_bytes = fetch_document_bytes(doc, strapi_url)
        if not pdf_bytes:
            if log_fn:
                log_fn("DOC:WARN", f"Could not retrieve file content for {doc_name}", level="WARN")
            continue

        raw_text = extract_text_from_pdf_bytes(pdf_bytes)
        if log_fn:
            log_fn("DOC:TEXT", f"Extracted {len(raw_text)} text characters from {doc_name} (PyMuPDF)")

        # 1. Local Qwen extraction
        qwen_data = query_local_qwen_for_extraction(
            doc_name, raw_text, ollama_url=ollama_url, ollama_model=ollama_model, log_fn=log_fn
        )

        # 2. Regex fallback / augmentation
        regex_data = regex_fallback_extraction(raw_text, doc_name)

        # Unified document extraction
        combined: Dict[str, Any] = {}
        for k in ["documentType", "legalName", "gstin", "panNumber", "udyamNumber", "epfoCode", "esicCode", "dpiitNumber", "nsicNumber", "status"]:
            val = qwen_data.get(k) or regex_data.get(k)
            if val and str(val).strip().lower() not in ("null", "none", ""):
                combined[k] = str(val).strip()

        aggregated["documentsProcessed"].append({
            "id": doc_id,
            "name": doc_name,
            "documentType": combined.get("documentType", regex_data.get("documentType")),
            "extracted": combined,
        })

        # Update aggregated fields and traceability
        mapping = {
            "companyName": combined.get("legalName"),
            "gstin": combined.get("gstin"),
            "panNumber": combined.get("panNumber"),
            "udyamId": combined.get("udyamNumber"),
            "epfoCode": combined.get("epfoCode"),
            "esicCode": combined.get("esicCode"),
            "dpiitNumber": combined.get("dpiitNumber"),
            "nsicNumber": combined.get("nsicNumber"),
        }

        for field_key, field_val in mapping.items():
            if field_val and not aggregated[field_key]:
                aggregated[field_key] = field_val
                aggregated["traceability"][field_key] = {
                    "value": field_val,
                    "sourceDoc": doc_name,
                    "documentId": doc_id,
                    "documentType": combined.get("documentType", regex_data.get("documentType")),
                }
                if log_fn:
                    log_fn("EXTRACT:FIELD", f"Extracted {field_key}: {field_val} (Source: {doc_name})")

    return aggregated