@echo off

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
timeout /t 2 >nul

cd /d "%~dp0"
start /b cmd /c "node server.js >> server.log 2>&1"
timeout /t 3 >nul
start /b cmd /c "npx vite >> vite.log 2>&1"
timeout /t 10 >nul
start http://localhost:5173

exit
