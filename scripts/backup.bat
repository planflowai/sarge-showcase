@echo off
set APP=%1
set TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
set DEST=backups\%APP%-%TIMESTAMP%

if "%APP%"=="" (
    echo Usage: backup.bat [app-folder-name]
    echo Example: backup.bat builder-standalone
    exit /b 1
)

echo Creating backup of apps\%APP% to %DEST%
xcopy /E /I /EXCLUDE:scripts\backup-exclude.txt "apps\%APP%" "%DEST%"
echo Backup complete: %DEST%
