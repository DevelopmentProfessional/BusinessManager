




$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location "$scriptDir"

# Find Python executable
$pythonExe = $null
$pythonArgs = @()

if (Test-Path ".\\.venv\\Scripts\\python.exe") {
	$pythonExe = ".\\.venv\\Scripts\\python.exe"
} elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
	$pythonExe = "python"
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
	$pythonExe = "py"
	$pythonArgs = @("-3")
} else {
	throw "Python not found. Install Python 3 and ensure 'python' (or 'py') is available in PATH."
}

$port = 8000
if ($env:PORT) { $port = [int]$env:PORT }

$bindHost = "0.0.0.0"
if ($env:HOST) { $bindHost = $env:HOST }

Write-Host "Starting Business Manager..." -ForegroundColor Cyan
Write-Host "Frontend will be available at: http://localhost:5173" -ForegroundColor Green
Write-Host "Backend API will be available at: http://localhost:$port" -ForegroundColor Green
Write-Host ""

# Start frontend (Vite) in a new window - use npm run dev:frontend from project root
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:frontend" -PassThru -WindowStyle Normal

Write-Host "Frontend started (PID: $($frontendProcess.Id))" -ForegroundColor Yellow

# Start backend (Uvicorn) in the current window
try {
	& $pythonExe @pythonArgs -m uvicorn backend.main:app --reload --host $bindHost --port $port
} finally {
	# When backend stops, also stop the frontend
	if ($frontendProcess -and !$frontendProcess.HasExited) {
		Write-Host "Stopping frontend..." -ForegroundColor Yellow
		Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
	}
}
