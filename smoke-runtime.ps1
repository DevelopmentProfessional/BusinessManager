$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

function Resolve-Python {
    $venvPy = Join-Path $scriptDir ".venv\Scripts\python.exe"
    if (Test-Path $venvPy) {
        return @{ exe = $venvPy; pythonPrefix = @() }
    }

    if (Get-Command "py" -ErrorAction SilentlyContinue) {
        return @{ exe = "py"; pythonPrefix = @("-3") }
    }

    if (Get-Command "python" -ErrorAction SilentlyContinue) {
        return @{ exe = "python"; pythonPrefix = @() }
    }

    throw "Python executable not found (.venv, py, or python)."
}

function Start-ServiceProcess {
    param(
        [string]$PythonExe,
        [string[]]$PythonPrefix,
        [string]$AppDir,
        [int]$Port,
        [string]$Label
    )

    $launchParams = @()
    $launchParams += $PythonPrefix
    $launchParams += @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "$Port", "--app-dir", $AppDir)

    $proc = Start-Process -FilePath $PythonExe -ArgumentList $launchParams -PassThru -WindowStyle Hidden
    Write-Host "$Label started (PID: $($proc.Id), port: $Port)" -ForegroundColor Green
    return $proc
}

function Wait-HttpEndpoint {
    param(
        [string]$Uri,
        [int]$Attempts = 25,
        [int]$DelaySeconds = 1
    )

    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Uri -Method Get -UseBasicParsing -TimeoutSec 2
            return $resp
        }
        catch {
            if ($i -eq $Attempts) {
                throw "Endpoint did not become ready: $Uri"
            }
            Start-Sleep -Seconds $DelaySeconds
        }
    }
}

$py = Resolve-Python
$backendProc = $null
$clientApiProc = $null

try {
    $backendDir = Join-Path $scriptDir "backend"
    $clientApiDir = Join-Path $scriptDir "client-api"

    $backendProc = Start-ServiceProcess -PythonExe $py.exe -PythonPrefix $py.pythonPrefix -AppDir $backendDir -Port 8100 -Label "Backend"
    $clientApiProc = Start-ServiceProcess -PythonExe $py.exe -PythonPrefix $py.pythonPrefix -AppDir $clientApiDir -Port 8101 -Label "Client API"

    $backendDocs = Wait-HttpEndpoint -Uri "http://127.0.0.1:8100/docs"
    $clientApiHealthResponse = Wait-HttpEndpoint -Uri "http://127.0.0.1:8101/health"
    $clientApiHealth = $clientApiHealthResponse.Content | ConvertFrom-Json

    Write-Host "backend_docs_status=$($backendDocs.StatusCode)" -ForegroundColor Cyan
    Write-Host "client_api_health=$($clientApiHealth | ConvertTo-Json -Compress)" -ForegroundColor Cyan
    Write-Host "Smoke runtime check PASSED" -ForegroundColor Green
}
finally {
    if ($backendProc -and -not $backendProc.HasExited) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($clientApiProc -and -not $clientApiProc.HasExited) {
        Stop-Process -Id $clientApiProc.Id -Force -ErrorAction SilentlyContinue
    }
}
