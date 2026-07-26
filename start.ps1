param(
    [ValidateSet("internal", "client", "launcher")]
    [string]$App = "internal",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root

$targets = @{
    internal = Join-Path $root "start-server.ps1"
    client   = Join-Path $root "start-client.ps1"
    launcher = Join-Path $root "launch.ps1"
}

$target = $targets[$App]
if (-not (Test-Path $target)) {
    throw "Target script not found: $target"
}

switch ($App) {
    "internal" {
        Write-Host "Starting Internal App (production-like)" -ForegroundColor Cyan
        Write-Host "  Frontend: https://localhost:5173" -ForegroundColor Green
        Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Green
    }
    "client" {
        Write-Host "Starting Client Portal" -ForegroundColor Cyan
        Write-Host "  Frontend: http://localhost:5174" -ForegroundColor Green
        Write-Host "  Backend:  http://localhost:8001" -ForegroundColor Green
    }
    "launcher" {
        Write-Host "Starting Unified Launcher UI" -ForegroundColor Cyan
    }
}

if ($DryRun) {
    Write-Host "DryRun: would run $target" -ForegroundColor Yellow
    return
}

& $target
