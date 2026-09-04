@echo off
title AI Tender Compliance Platform - Launcher
echo ======================================================================
echo    Starting AI-Powered Bid Compliance Verification Platform (SIH)
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting Strapi v5 Backend (Port 1337)...
start "Strapi Backend (Port 1337)" cmd /k "cd /d "%~dp0backend" && npm run develop"

timeout /t 5 /nobreak >nul

echo [2/3] Starting Python AI Worker (Port 8000)...
start "AI Worker - FastAPI (Port 8000)" cmd /k "cd /d "%~dp0ai-worker" && .\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [3/3] Starting Next.js Frontend (Port 3000)...
start "Frontend - Next.js (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ======================================================================
echo    All services launched in separate windows!
echo    - Frontend:    http://localhost:3000
echo    - Strapi:      http://localhost:1337/admin
echo    - AI Worker:   http://localhost:8000/health
echo ======================================================================
echo.
pause
