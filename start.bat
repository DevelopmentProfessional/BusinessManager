@echo off
echo 🚀 Starting Business Manager Application...
echo.

REM Defaults for environment-configurable ports and URLs
if not defined PORT set PORT=8000
if not defined VITE_PORT set VITE_PORT=5173
if not defined ALLOWED_ORIGINS set ALLOWED_ORIGINS=http://localhost:%VITE_PORT%,https://*.onrender.com
if not defined VITE_API_URL set VITE_API_URL=http://localhost:%PORT%/api/v1

echo 📦 Installing minimal backend dependencies...
cd backend
pip install fastapi uvicorn sqlmodel python-multipart python-dotenv
if errorlevel 1 (
    echo ⚠️  Some dependencies failed, but continuing...
)

echo 📦 Installing frontend dependencies...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo ❌ Frontend installation failed
    pause
    exit /b 1
)

cd ..

echo.
echo ✅ Starting servers...
echo    Backend API: http://localhost:%PORT%
echo    Frontend:    http://localhost:%VITE_PORT%
echo    API Docs:    http://localhost:%PORT%/docs
echo.

start "Backend Server" cmd /k "cd backend && set PORT=%PORT% && set ALLOWED_ORIGINS=%ALLOWED_ORIGINS% && python -m uvicorn main:app --reload --host 0.0.0.0 --port %PORT%"
start "Frontend Server" cmd /k "cd frontend && set VITE_PORT=%VITE_PORT% && set VITE_API_URL=%VITE_API_URL% && npm run dev"

echo 🎉 Both servers are starting in separate windows!
echo Press any key to exit...
pause >nul
