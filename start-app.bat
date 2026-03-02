@echo off
if "%1"=="" (
    echo Usage: start-app.bat [app-name] [port]
    echo Example: start-app.bat chat-standalone 3100
    exit /b 1
)
echo Starting %1 on port %2...
cd /d L:\ai_builder\ai_builderv2\apps\%1
npx next dev -p %2 --webpack
