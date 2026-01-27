




# Kill existing Node.js processes (ignore errors if none running)
try {
	Get-Process -Name "node" -ErrorAction Stop | Stop-Process -Force
} catch {}

# Navigate to frontend directory (relative to script location)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location "$scriptDir/frontend"

# Start the development server
Start-Process powershell -ArgumentList "-NoProfile -Command npm run dev" -NoNewWindow

# Wait a moment for server to start
Start-Sleep -Seconds 3

# Open browser
Start-Process "http://localhost:5173"
