@echo off
title Launch Pad — The Foundry
echo.
echo  ==========================================
echo    LAUNCH PAD — The Foundry
echo    Starting on port 3109...
echo  ==========================================
echo.

cd /d "L:\ai_builder\ai_builderv2\apps\launchpad-standalone"

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

:: Start the Launch Pad
echo Starting Launch Pad on http://localhost:3109
call npm run dev
