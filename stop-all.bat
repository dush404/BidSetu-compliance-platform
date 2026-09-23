@echo off
title BidSetu - Stopper
echo ======================================================================
echo    Stopping BidSetu Services (Ports 3000, 8000, 1337)
echo ======================================================================
echo.

powershell -Command "foreach ($port in @(3000, 8000, 1337)) { $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue; if ($conn) { $pid = $conn.OwningProcess | Select-Object -Unique; Write-Host ('Stopping port ' + $port + ' (PID ' + $pid + ')'); Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } else { Write-Host ('Port ' + $port + ' is already free') } }"

echo.
echo ======================================================================
echo    All services stopped and ports freed!
echo ======================================================================
echo.
pause
