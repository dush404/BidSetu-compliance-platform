# AI-Powered Bid Compliance Verification Platform

SIH26100 project for verifying bidder compliance documents and recording verification outcomes.

## Tech Stack

- Frontend: Next.js 14, TypeScript, App Router, Tailwind CSS
- Backend: Strapi 5 CMS with SQLite
- AI worker: Python 3.9, FastAPI, PyMuPDF, optional Ollama client
- Orchestration: Docker Compose

## Prerequisites

- Docker Desktop with Docker Compose
- Node.js 20 or 22 and npm
- Python 3.9 or newer for running the worker outside Docker

## Quick Start

```bash
docker-compose up --build
```

Then open:

- Frontend: http://localhost:3000
- Strapi admin: http://localhost:1337/admin
- AI worker health: http://localhost:8000/health

## No-GPU Mode

Ollama is intentionally not included in Docker Compose yet. The AI worker runs in mock-data mode by default and serves the five sample bidders in `ai-worker/mock_data.json`. When Ollama is available later, set `OLLAMA_URL` and add the integration logic without changing the Compose services.


python -m uvicorn main:app --reload --port 8000