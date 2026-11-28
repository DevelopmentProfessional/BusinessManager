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

$tunnelScript = Join-Path $root "scripts\ensure-db-tunnel.ps1"
if (Test-Path $tunnelScript) {
    . $tunnelScript
}

# Prefer the repo-level AWS URL, then allow local/backend overrides to replace it.
Import-EnvFile (Join-Path $root ".env")
Import-EnvFile (Join-Path $root "backend\.env")
Import-EnvFile (Join-Path $root "backend\.env.local")

if (Get-Command Ensure-AwsDbTunnel -ErrorAction SilentlyContinue) {
    $null = Ensure-AwsDbTunnel -RootPath $root -RoleName "Internal backend" -RequireReady
}

# Start backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; $env:DATABASE_URL='$env:DATABASE_URL'; ..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000" -WindowStyle Normal

# Start frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev" -WindowStyle Normal

Write-Host "Servers starting..."
Write-Host "  Backend:  http://localhost:8000"
Write-Host "  Frontend: https://localhost:5173"
