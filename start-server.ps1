




$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location "$scriptDir"

# Find a Python that actually runs (avoids Windows Store stub that fails on -m uvicorn)
function Test-PythonRuns {
	param([string]$Exe, [array]$Args = @())
	if (-not (Get-Command $Exe -ErrorAction SilentlyContinue)) { return $false }
	$null = & $Exe @Args -c "import sys; sys.exit(0)" 2>&1
	return ($LASTEXITCODE -eq 0)
}

$pythonExe = $null
$pythonArgs = @()

if (Test-Path ".\\.venv\\Scripts\\python.exe") {
	$venvPy = (Resolve-Path ".\\.venv\\Scripts\\python.exe").Path
	if (Test-PythonRuns $venvPy) {
		$pythonExe = $venvPy
	}
}
if (-not $pythonExe -and (Get-Command "py" -ErrorAction SilentlyContinue)) {
	# Prefer py -3 (reliable on Windows) over raw "python" which can be a Store stub
	if (Test-PythonRuns "py" @("-3")) {
		$pythonExe = "py"
		$pythonArgs = @("-3")
	}
}
if (-not $pythonExe -and (Get-Command "python" -ErrorAction SilentlyContinue)) {
	if (Test-PythonRuns "python") {
		$pythonExe = "python"
	}
}
if (-not $pythonExe) {
	Write-Host "Python not found or not working. On Windows, 'python' may be a Store stub." -ForegroundColor Red
	Write-Host "Try: py -3 -m pip install -r backend\requirements.txt" -ForegroundColor Yellow
	throw "No working Python (python/py or .venv) found."
}
Write-Host "Using Python: $pythonExe $($pythonArgs -join ' ')" -ForegroundColor Gray

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
Write-Host "Starting backend in this window (any error below is from the backend)..." -ForegroundColor Cyan
Write-Host ""

# Start backend (Uvicorn) in the current window
$backendExitCode = 0
try {
	& $pythonExe @pythonArgs -m uvicorn backend.main:app --reload --host $bindHost --port $port
	$backendExitCode = $LASTEXITCODE
} catch {
	Write-Host ""
	Write-Host "Backend error: $($_.Exception.Message)" -ForegroundColor Red
	$backendExitCode = 1
} finally {
	# When backend stops, also stop the frontend
	if ($frontendProcess -and !$frontendProcess.HasExited) {
		Write-Host ""
		Write-Host "Stopping frontend (PID: $($frontendProcess.Id))..." -ForegroundColor Yellow
		Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
	}
	if ($backendExitCode -ne 0) {
		Write-Host ""
		Write-Host "Backend exited with code $backendExitCode. Common causes:" -ForegroundColor Yellow
		Write-Host "  - Missing dependencies: run  py -m pip install -r backend\requirements.txt" -ForegroundColor Gray
		Write-Host "  - Port 8000 in use: close the app using it or set PORT=8001" -ForegroundColor Gray
		Write-Host "  - Wrong directory: run this script from the project root (BusinessManager folder)" -ForegroundColor Gray
		Read-Host "Press Enter to close"
		exit $backendExitCode
	}
}
