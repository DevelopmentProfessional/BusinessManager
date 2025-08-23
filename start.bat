@echo off
echo Starting Business Manager Application...

echo.
echo Starting Backend Server...
cd backend
start "Backend Server" python main.py

echo.
echo Starting Frontend Server...
cd ..\frontend
start "Frontend Server" npm run dev

echo.
echo Application starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause > nul
