param(
  [string]$HostName = "localhost",
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8000 }),
  [int]$TimeoutSec = 5
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg)  { Write-Host $msg -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host $msg -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host $msg -ForegroundColor Red }

$baseUrl   = "http://${HostName}:${Port}"
$healthUrl = "${baseUrl}/health"

Write-Info "Checking backend at $baseUrl ..."

# 1) Check TCP port availability
try {
  if (Get-Command Test-NetConnection -ErrorAction SilentlyContinue) {
    $isUp = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
    if (-not $isUp) {
      Write-Err "TCP port $Port is not reachable on $HostName. Is the backend running?"

      # Recommend exact commands based on repo layout
      $repoRoot    = $PSScriptRoot
      $backendMain = Join-Path $repoRoot 'backend\main.py'
      if (Test-Path $backendMain) {
        Write-Warn "Start from backend/:"
        Write-Host "  cd backend; python -m uvicorn main:app --reload --host 0.0.0.0 --port $Port" -ForegroundColor Yellow
        Write-Warn "Or start from repo root (module path includes folder):"
        Write-Host "  python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port $Port" -ForegroundColor Yellow
        Write-Warn "Or run the helper script:"
        Write-Host "  .\start.ps1" -ForegroundColor Yellow
      } else {
        Write-Warn "Tip: run uvicorn with your app module, e.g.:"
        Write-Host  "  python -m uvicorn main:app --reload --host 0.0.0.0 --port $Port" -ForegroundColor Yellow
      }

      # Quick prerequisite check
      if (!(Get-Command python -ErrorAction SilentlyContinue)) {
        Write-Err "Python not found in PATH. Install Python 3.9+ and retry."
      } else {
        $null = & python -c "import uvicorn, fastapi" 2>$null
        if ($LASTEXITCODE -ne 0) {
          Write-Warn "Missing Python modules. Install:"
          Write-Host  "  pip install fastapi uvicorn" -ForegroundColor Yellow
        }
      }
      exit 2
    }
  } else {
    Write-Warn "Test-NetConnection not available; skipping TCP check."
  }
}
catch { Write-Warn "Port check skipped: $($_.Exception.Message)" }

# 2) Call /health endpoint
try {
  $resp = Invoke-RestMethod -Uri $healthUrl -TimeoutSec $TimeoutSec -Method Get
  Write-Ok   "Health OK"
  Write-Info ("Response: " + ($resp | ConvertTo-Json -Depth 5))
  exit 0
}
catch {
  Write-Err "Health check failed: $($_.Exception.Message)"
  Write-Warn "If you see 'Could not import module \"main\"' when starting uvicorn from the repo root, use:"
  Write-Host  "  python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port $Port" -ForegroundColor Yellow
  Write-Warn "Or run from the backend folder:"
  Write-Host  "  cd backend; python -m uvicorn main:app --reload --host 0.0.0.0 --port $Port" -ForegroundColor Yellow
  try {
    $raw = Invoke-WebRequest -Uri $healthUrl -TimeoutSec $TimeoutSec -Method Get -ErrorAction Stop
    Write-Info ("Raw content: " + $raw.Content)
  } catch {}
  exit 1
}
