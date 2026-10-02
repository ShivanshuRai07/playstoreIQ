@echo off
echo ================================================
echo   Google Play Store BI Dashboard - Launcher
echo ================================================
echo.
echo [1/2] Starting Flask backend...
start "PlayStore API" cmd /c "cd /d "%~dp0backend" && python app.py"
echo Backend starting on http://127.0.0.1:5000
echo.
echo [2/2] Opening dashboard in browser...
timeout /t 4 /nobreak >nul
start "" "%~dp0frontend\index.html"
echo.
echo Dashboard should now be open!
echo Press Ctrl+C in the backend window to stop the server.
pause
