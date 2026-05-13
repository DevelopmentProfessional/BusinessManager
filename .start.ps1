# .start.ps1 — Start frontend (Vite) and backend (uvicorn) dev servers

$root = $PSScriptRoot

function Import-EnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) { return }

    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
        }
    }
}

# Prefer the tunnel-local override, then fall back to the normal backend env.
Import-EnvFile (Join-Path $root "backend\.env.local")
Import-EnvFile (Join-Path $root "backend\.env")

# Start backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; $env:DATABASE_URL='$env:DATABASE_URL'; ..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000" -WindowStyle Normal

# Start frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev" -WindowStyle Normal

Write-Host "Servers starting..."
Write-Host "  Backend:  http://localhost:8000"
Write-Host "  Frontend: https://localhost:5173"
