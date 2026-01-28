




$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location "$scriptDir"

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

& $pythonExe @pythonArgs -m uvicorn backend.main:app --reload --host $bindHost --port $port
