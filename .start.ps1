# .start.ps1 — Start frontend (Vite) and backend (uvicorn) dev servers

$root = $PSScriptRoot

# Load DATABASE_URL from backend\.env if present
$envFile = Join-Path $root "backend\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
        }
    }
}

# Start backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; $env:DATABASE_URL='$env:DATABASE_URL'; ..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000" -WindowStyle Normal

# Start frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev" -WindowStyle Normal

Write-Host "Servers starting..."
Write-Host "  Backend:  http://localhost:8000"
Write-Host "  Frontend: https://localhost:5173"
