@echo off
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Memory Lane's auto-load mode needs Node.js: https://nodejs.org
  echo You can also just open index.html instead.
  pause
  exit /b 1
)
node server.js || pause
