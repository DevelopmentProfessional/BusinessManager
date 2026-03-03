# run-local.ps1
# Runs regression tests (stages 1, 2, 4) against the local dev server.
# Called automatically by start-server.ps1 - do not run during production deployments.
#
# Usage:  .\regressiontest\run-local.ps1 [-Port 8000]

param([int]$Port = 8000)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

$regPython = Join-Path $scriptDir ".venv-regression\Scripts\python.exe"
if (-not (Test-Path $regPython)) {
    Write-Host ""
    Write-Host "  Regression venv not found - skipping tests." -ForegroundColor Yellow
    Write-Host "  To set up: cd regressiontest && pip install -r requirements.txt" -ForegroundColor Gray
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 0
}

Write-Host ""
Write-Host "  Regression Tests  (stages 1, 2, 4)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Waiting for backend on http://localhost:$Port/health ..." -ForegroundColor Yellow

$ready = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $r = Invoke-WebRequest "http://localhost:$Port/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host "    ($i/30) not ready, retrying in 2s..." -ForegroundColor DarkGray
    Start-Sleep 2
}

if (-not $ready) {
    Write-Host ""
    Write-Host "  Backend did not respond within 60s - tests skipped." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "  Backend ready." -ForegroundColor Green
Write-Host ""

& $regPython -m pytest stage1_precheck/ stage2_api/ stage4_database/ -v --tb=short

$exitCode = $LASTEXITCODE
Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "  All regression tests passed." -ForegroundColor Green
} else {
    Write-Host "  Some tests failed - see output above." -ForegroundColor Red
    Write-Host "  Report: regressiontest\reports\regression_report.html" -ForegroundColor Gray
}
Write-Host ""
Read-Host "Press Enter to close"
exit $exitCode
