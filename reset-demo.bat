@echo off
title Reset Demo Data - AI Tender Compliance Platform
echo ======================================================================
echo    Resetting Verification Cache and Bidder Statuses (Clean State)
echo ======================================================================
echo.

cd /d "%~dp0"
python scripts\reset_demo_data.py

echo.
echo Tip: Also press Ctrl+Shift+R (or Ctrl+F5) in your browser to clear frontend browser cache.
echo.
pause
