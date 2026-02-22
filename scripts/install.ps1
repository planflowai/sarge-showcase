# ============================================
# SARGE One-Click Installer (Windows PowerShell)
# ============================================
# Run this script in PowerShell:
#   Set-ExecutionPolicy Bypass -Scope Process
#   .\install.ps1
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " SARGE One-Click Installer" -ForegroundColor Cyan
Write-Host " AI Safety Research Guard Engine" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

# Check prerequisites
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
$NodeVersion = $null
try {
    $NodeVersion = & node --version 2>$null
} catch {}

if (-not $NodeVersion) {
    Write-Host "  ERROR: Node.js not found!" -ForegroundColor Red
    Write-Host "  Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js: $NodeVersion" -ForegroundColor Green

# Check npm
$NpmVersion = & npm --version 2>$null
if (-not $NpmVersion) {
    Write-Host "  ERROR: npm not found!" -ForegroundColor Red
    exit 1
}
Write-Host "  npm: $NpmVersion" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "[2/6] Installing dependencies..." -ForegroundColor Yellow
Push-Location $ProjectDir
try {
    & npm install 2>&1 | Out-Null
    Write-Host "  Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Failed to install dependencies" -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Create logs directory
Write-Host ""
Write-Host "[3/6] Creating directories..." -ForegroundColor Yellow
$LogsDir = Join-Path $ProjectDir "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}
Write-Host "  Logs directory: $LogsDir" -ForegroundColor Green

# Create .env if it doesn't exist
Write-Host ""
Write-Host "[4/6] Checking configuration..." -ForegroundColor Yellow
$EnvFile = Join-Path $ProjectDir ".env"
if (-not (Test-Path $EnvFile)) {
    $EnvTemplate = @"
# SARGE Configuration
# ===================

# Ollama (Local LLM)
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI (Optional)
# OPENAI_API_KEY=your-key-here

# Anthropic (Optional)
# ANTHROPIC_API_KEY=your-key-here

# Google AI (Optional)
# GOOGLE_AI_API_KEY=your-key-here

# xAI (Optional)
# XAI_API_KEY=your-key-here
"@
    Set-Content -Path $EnvFile -Value $EnvTemplate
    Write-Host "  Created .env template" -ForegroundColor Green
    Write-Host "  Edit .env to add your API keys" -ForegroundColor Yellow
} else {
    Write-Host "  .env file exists" -ForegroundColor Green
}

# Build the application
Write-Host ""
Write-Host "[5/6] Building application..." -ForegroundColor Yellow
try {
    & npm run build 2>&1 | Out-Null
    Write-Host "  Build complete" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Build failed, will run in dev mode" -ForegroundColor Yellow
}

Pop-Location

# Create desktop shortcut
Write-Host ""
Write-Host "[6/6] Creating shortcuts..." -ForegroundColor Yellow
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "SARGE.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -NoExit -Command `"cd '$ProjectDir'; npm run dev`""
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.Description = "SARGE - AI Safety Research Guard Engine"
$Shortcut.Save()
Write-Host "  Desktop shortcut created" -ForegroundColor Green

# Done
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start SARGE:" -ForegroundColor Cyan
Write-Host "  1. Double-click the 'SARGE' shortcut on your desktop" -ForegroundColor White
Write-Host "  2. Or run: npm run dev (from $ProjectDir)" -ForegroundColor White
Write-Host "  3. Or run: node scripts/sarge-daemon.js start" -ForegroundColor White
Write-Host ""
Write-Host "Dashboard will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

# Register as Windows service (optional)
Write-Host ""
Write-Host "[7/7] Setting up auto-start..." -ForegroundColor Yellow

$RegisterService = Read-Host "Register SARGE as Windows startup task? (Y/N)"
if ($RegisterService -eq "Y" -or $RegisterService -eq "y") {
    $TaskName = "SARGE-Daemon"
    $DaemonScript = Join-Path $ScriptDir "sarge-daemon.js"

    # Remove existing task if present
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    # Create scheduled task to run at startup
    $Action = New-ScheduledTaskAction -Execute "node.exe" -Argument "`"$DaemonScript`" start --silent" -WorkingDirectory $ProjectDir
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "SARGE AI Safety Guard - Background Daemon" | Out-Null

    Write-Host "  Auto-start registered: $TaskName" -ForegroundColor Green
    Write-Host "  SARGE will start automatically on Windows login" -ForegroundColor Cyan
} else {
    Write-Host "  Skipped auto-start registration" -ForegroundColor Yellow
}

# Done
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start SARGE:" -ForegroundColor Cyan
Write-Host "  1. Double-click the 'SARGE' shortcut on your desktop" -ForegroundColor White
Write-Host "  2. Or run: npm run dev (from $ProjectDir)" -ForegroundColor White
Write-Host "  3. Or run: node scripts/sarge-daemon.js start" -ForegroundColor White
Write-Host "  4. Or run: node scripts/sarge-daemon.js start --silent (background)" -ForegroundColor White
Write-Host ""
Write-Host "Daemon commands:" -ForegroundColor Cyan
Write-Host "  node scripts/sarge-daemon.js status   - One-line status" -ForegroundColor White
Write-Host "  node scripts/sarge-daemon.js stop     - Stop daemon" -ForegroundColor White
Write-Host ""
Write-Host "Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Status API: http://localhost:3000/api/status" -ForegroundColor Cyan
Write-Host ""

# Ask to start now
$Start = Read-Host "Start SARGE daemon now? (Y/N)"
if ($Start -eq "Y" -or $Start -eq "y") {
    Write-Host ""
    Write-Host "Starting SARGE daemon..." -ForegroundColor Yellow
    Push-Location $ProjectDir
    & node scripts/sarge-daemon.js start
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:3000"
    Pop-Location
}
