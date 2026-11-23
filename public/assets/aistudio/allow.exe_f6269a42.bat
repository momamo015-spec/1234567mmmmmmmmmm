@echo off
setlocal
title NOVA Web Launcher - Port 30
color 0A
cls

set "PROJECT_DIR=C:\Users\dell\3D Objects\google"
set "PORT=30"
set "SITE_URL=http:/google.1.:30"

echo ================================================
echo          Starting NOVA on port %PORT%
echo ================================================
echo.

if not exist "%PROJECT_DIR%\package.json" (
  echo [ERROR] package.json was not found.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js/npm is not installed or is not in PATH.
  pause
  exit /b 1
)

echo [1/2] Starting npm start on port %PORT%...
start "NOVA server" /min /d "%PROJECT_DIR%" cmd /c npm start

echo [2/2] Waiting for the website...
timeout /t 4 /nobreak >nul

echo Opening Microsoft Edge...
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "NOVA" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%SITE_URL%" --window-size=1280,800 --title="NOVA"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "NOVA" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%SITE_URL%" --window-size=1280,800 --title="NOVA"
) else (
  start "NOVA" msedge --app="%SITE_URL%" --window-size=1280,800 --title="NOVA"
)

echo.
echo [SUCCESS] NOVA is running at %SITE_URL%
endlocal
exit /b 0
