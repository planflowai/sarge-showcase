@echo off
REM ============================================
REM SARGE Windows Service Installer
REM ============================================
REM This script installs SARGE as a Windows service
REM using NSSM (Non-Sucking Service Manager)
REM
REM Prerequisites:
REM   1. Download NSSM from https://nssm.cc/download
REM   2. Extract nssm.exe to this directory or add to PATH
REM   3. Run this script as Administrator
REM ============================================

setlocal

set SERVICE_NAME=SARGE
set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..

echo.
echo ============================================
echo SARGE Windows Service Installer
echo ============================================
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Check if NSSM is available
where nssm >nul 2>&1
if %errorLevel% neq 0 (
    if exist "%SCRIPT_DIR%nssm.exe" (
        set NSSM="%SCRIPT_DIR%nssm.exe"
    ) else (
        echo ERROR: NSSM not found.
        echo Please download from https://nssm.cc/download
        echo and place nssm.exe in this directory.
        pause
        exit /b 1
    )
) else (
    set NSSM=nssm
)

REM Check if service already exists
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo Service %SERVICE_NAME% already exists.
    echo.
    choice /C YN /M "Do you want to remove and reinstall it"
    if errorlevel 2 goto :eof
    echo Removing existing service...
    %NSSM% stop %SERVICE_NAME% >nul 2>&1
    %NSSM% remove %SERVICE_NAME% confirm
    timeout /t 2 >nul
)

echo Installing %SERVICE_NAME% service...

REM Find Node.js
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js not found in PATH.
    pause
    exit /b 1
)
for /f "delims=" %%i in ('where node') do set NODE_PATH=%%i

REM Install the service
%NSSM% install %SERVICE_NAME% "%NODE_PATH%" "%SCRIPT_DIR%sarge-daemon.js" start

REM Configure the service
%NSSM% set %SERVICE_NAME% AppDirectory "%PROJECT_DIR%"
%NSSM% set %SERVICE_NAME% DisplayName "SARGE Poison Pill Detection"
%NSSM% set %SERVICE_NAME% Description "AI Safety Research Guard Engine - Poison pill detection and hallucination prevention"
%NSSM% set %SERVICE_NAME% Start SERVICE_AUTO_START
%NSSM% set %SERVICE_NAME% AppStdout "%PROJECT_DIR%\logs\service-stdout.log"
%NSSM% set %SERVICE_NAME% AppStderr "%PROJECT_DIR%\logs\service-stderr.log"
%NSSM% set %SERVICE_NAME% AppRotateFiles 1
%NSSM% set %SERVICE_NAME% AppRotateBytes 10485760

echo.
echo ============================================
echo Service installed successfully!
echo ============================================
echo.
echo Service Name: %SERVICE_NAME%
echo Status: Use "sc query %SERVICE_NAME%" to check status
echo.
echo Commands:
echo   net start %SERVICE_NAME%   - Start the service
echo   net stop %SERVICE_NAME%    - Stop the service
echo   sc delete %SERVICE_NAME%   - Remove the service
echo.
echo Dashboard will be available at:
echo   http://localhost:3000
echo.

choice /C YN /M "Start the service now"
if errorlevel 2 goto :eof
net start %SERVICE_NAME%

echo.
echo Service started. Opening dashboard...
timeout /t 3 >nul
start http://localhost:3000

pause
