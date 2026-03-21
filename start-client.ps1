
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location "$scriptDir"

# Find a Python that actually runs
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
	Write-Host "Python not found or not working." -ForegroundColor Red
	Write-Host "Try: py -3 -m pip install -r client-api\requirements.txt" -ForegroundColor Yellow
	throw "No working Python found."
}
Write-Host "Using Python: $pythonExe $($pythonArgs -join ' ')" -ForegroundColor Gray

$port = 8001
if ($env:CLIENT_API_PORT) { $port = [int]$env:CLIENT_API_PORT }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Starting Client Portal (customer-facing)  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Client Portal (frontend):  http://localhost:5174" -ForegroundColor Green
Write-Host "  Client API (backend):      http://localhost:$port" -ForegroundColor Green
Write-Host ""
Write-Host "  Internal app runs separately via start-server.ps1" -ForegroundColor Gray
Write-Host ""

# Check that client-api dependencies are installed
$clientApiReqs = Join-Path $scriptDir "client-api\requirements.txt"
if (-not (Test-Path $clientApiReqs)) {
	Write-Host "client-api\requirements.txt not found. Are you in the right directory?" -ForegroundColor Red
	Read-Host "Press Enter to close"
	exit 1
}

# Install client-api dependencies if needed
Write-Host "Checking client-api dependencies..." -ForegroundColor Gray
& $pythonExe @pythonArgs -m pip install -r client-api\requirements.txt --quiet
if ($LASTEXITCODE -ne 0) {
	Write-Host "Failed to install client-api dependencies." -ForegroundColor Red
	Read-Host "Press Enter to close"
	exit 1
}

# Install client-portal npm dependencies if node_modules missing
$portalModules = Join-Path $scriptDir "client-portal\node_modules"
if (-not (Test-Path $portalModules)) {
	Write-Host "Installing client-portal npm packages (first run)..." -ForegroundColor Yellow
	Push-Location "client-portal"
	npm install
	Pop-Location
	if ($LASTEXITCODE -ne 0) {
		Write-Host "npm install failed." -ForegroundColor Red
		Read-Host "Press Enter to close"
		exit 1
	}
}

# Start client-portal (Vite dev server) in a new window
$frontendProcess = Start-Process -FilePath "cmd.exe" `
	-ArgumentList "/c cd client-portal && npm run dev" `
	-PassThru -WindowStyle Normal
Write-Host "Client portal frontend started (PID: $($frontendProcess.Id))" -ForegroundColor Yellow

# Start client-api (Uvicorn) in this window
Write-Host "Starting client API in this window..." -ForegroundColor Cyan
Write-Host ""

$apiExitCode = 0
try {
	Set-Location "client-api"
	& $pythonExe @pythonArgs -m uvicorn main:app --reload --host 127.0.0.1 --port $port
	$apiExitCode = $LASTEXITCODE
} catch {
	Write-Host ""
	Write-Host "Client API error: $($_.Exception.Message)" -ForegroundColor Red
	$apiExitCode = 1
} finally {
	Set-Location $scriptDir

	# Stop frontend when API stops
	if ($frontendProcess -and !$frontendProcess.HasExited) {
		Write-Host ""
		Write-Host "Stopping client portal frontend (PID: $($frontendProcess.Id))..." -ForegroundColor Yellow
		Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
	}

	if ($apiExitCode -ne 0) {
		Write-Host ""
		Write-Host "Client API exited with code $apiExitCode. Common causes:" -ForegroundColor Yellow
		Write-Host "  - Missing DATABASE_URL: create client-api\.env with DATABASE_URL=..." -ForegroundColor Gray
		Write-Host "  - Port $port in use: set CLIENT_API_PORT=8002 before running" -ForegroundColor Gray
		Write-Host "  - Missing deps: py -m pip install -r client-api\requirements.txt" -ForegroundColor Gray
		Read-Host "Press Enter to close"
		exit $apiExitCode
	}
}
