$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

$venvPython = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    throw "Missing Python venv executable at $venvPython"
}

$checks = @()

function Invoke-Check {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host "[RUN] $Name" -ForegroundColor Cyan
    try {
        & $Command
        $script:checks += [pscustomobject]@{ Name = $Name; Status = "PASS" }
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    catch {
        $script:checks += [pscustomobject]@{ Name = $Name; Status = "FAIL"; Detail = $_.Exception.Message }
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        throw
    }
}

Invoke-Check -Name "Root manager build" -Command {
    cmd /c "npm run build" | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Root manager build failed with exit code $LASTEXITCODE"
    }
}

Invoke-Check -Name "Client portal build" -Command {
    Push-Location (Join-Path $root "client-portal")
    try {
        cmd /c "npm run build" | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Client portal build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Invoke-Check -Name "Client API lifecycle tests" -Command {
    Push-Location (Join-Path $root "client-api")
    try {
        & $venvPython -m unittest tests.test_orders_lifecycle | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Client API lifecycle tests failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Invoke-Check -Name "Runtime smoke (backend + client-api)" -Command {
    powershell -ExecutionPolicy Bypass -File (Join-Path $root "smoke-runtime.ps1") | Out-Host
}

Write-Host "" 
Write-Host "==== Step 6 Verification Summary ====" -ForegroundColor Yellow
$checks | ForEach-Object {
    $color = if ($_.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host ("- {0}: {1}" -f $_.Name, $_.Status) -ForegroundColor $color
}
Write-Host "All Step 6 checks completed." -ForegroundColor Green
