# Business Manager - Start Script
Write-Host "🚀 Starting Business Manager Application..." -ForegroundColor Green

# Check if Python is available
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python not found. Please install Python 3.9+ and try again." -ForegroundColor Red
    exit 1
}

# Check if Node.js is available
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js and try again." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow

# Install backend dependencies (minimal set)
Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
Set-Location backend
python -m pip install fastapi uvicorn sqlmodel python-multipart --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Some backend dependencies failed to install, but continuing..." -ForegroundColor Yellow
}

# Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
Set-Location ../frontend
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend dependencies failed to install." -ForegroundColor Red
    exit 1
}

Set-Location ..

Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Starting both backend and frontend..." -ForegroundColor Green
Write-Host "   Backend API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "   Frontend:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "   API Docs:    http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""

# Start both services
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host 'Starting Backend Server...' -ForegroundColor Green; python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host 'Starting Frontend Server...' -ForegroundColor Green; npm run dev"

Write-Host "🎉 Both servers are starting in separate windows!" -ForegroundColor Green
Write-Host "Press any key to exit this script..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
