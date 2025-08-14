@echo off
echo 🚀 Starting Business Manager Application...
echo.

echo 📦 Installing minimal backend dependencies...
cd backend
pip install fastapi uvicorn sqlmodel python-multipart
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
echo    Backend API: http://localhost:8000
echo    Frontend:    http://localhost:5173
echo    API Docs:    http://localhost:8000/docs
echo.

start "Backend Server" cmd /k "cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo 🎉 Both servers are starting in separate windows!
echo Press any key to exit...
pause >nul
