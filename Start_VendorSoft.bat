@echo off
title Vendor Soft - Launching...
cd /d "%~dp0"
echo ========================================================
echo     📰 Vendor Soft - Newspaper Distribution System
echo ========================================================
echo.
echo Starting application server on http://localhost:5055 ...
echo.

if exist "publish\vendor_soft_app.exe" (
    start "" "publish\vendor_soft_app.exe" --urls "http://localhost:5055"
) else if exist "vendor_soft_app.exe" (
    start "" "vendor_soft_app.exe" --urls "http://localhost:5055"
) else (
    start /B dotnet run --urls "http://localhost:5055"
)

timeout /t 2 >nul

REM Launch Google Chrome or Microsoft Edge as Desktop App
start chrome --app=http://localhost:5055 || start msedge --app=http://localhost:5055 || start http://localhost:5055

echo.
echo Vendor Soft is now running!
echo URL: http://localhost:5055
echo (Keep this window open while using the software)
echo.
