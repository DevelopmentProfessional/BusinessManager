# PowerShell script to start Business Management API with minimal logging

Write-Host "Starting Business Management API with minimal logging..." -ForegroundColor Green
Write-Host ""

# Set environment variables
$env:QUIET_MODE = "true"
$env:SQLALCHEMY_WARN_20 = "false"

# Change to backend directory and start server
Set-Location backend
python start_server.py
