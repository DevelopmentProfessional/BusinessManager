$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPath = Join-Path $scriptDir '.venv-regression'
$pythonExe = Join-Path $venvPath 'Scripts\python.exe'

Write-Host 'Setting up regression test virtual environment...'
if (-not (Test-Path $pythonExe)) {
    python -m venv $venvPath
}

& $pythonExe -m pip install --upgrade pip
& $pythonExe -m pip install -r (Join-Path $scriptDir 'requirements.txt')
& $pythonExe -m playwright install chromium

$envPath = Join-Path $scriptDir '.env'
$templatePath = Join-Path $scriptDir '.env.template'
if (-not (Test-Path $envPath) -and (Test-Path $templatePath)) {
    Copy-Item $templatePath $envPath
    Write-Host 'Created regressiontest/.env from .env.template (fill in ADMIN_PASSWORD).'
}

Write-Host "Done. Activate with: & '$venvPath\Scripts\Activate.ps1'"
Write-Host 'Run tests from regressiontest/, for example: python orchestrator.py'
