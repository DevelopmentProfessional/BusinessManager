$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root = Split-Path -Parent $scriptDir
Set-Location $root

function Get-RepoDatabaseUrl {
    $envFile = Join-Path $root ".env"
    if (Test-Path $envFile) {
        $content = Get-Content -LiteralPath $envFile -Raw
        $match = [regex]::Match($content, '(?m)^\s*DATABASE_URL=(.+)$')
        if ($match.Success) {
            return $match.Groups[1].Value.Trim()
        }
    }

    if ($env:DATABASE_URL) {
        return $env:DATABASE_URL.Trim()
    }

    throw "DATABASE_URL was not found in the repo root .env or current environment."
}

function Normalize-PostgresUrl {
    param([string]$Url)

    $value = ""
    if ($null -ne $Url) {
        $value = $Url.Trim()
    }
    if ($value.StartsWith("postgres://")) {
        return $value.Replace("postgres://", "postgresql://", 1)
    }
    return $value
}

function New-LocalDatabaseUrl {
    param(
        [string]$SourceUrl,
        [int]$LocalPort
    )

    $uri = [Uri](Normalize-PostgresUrl $SourceUrl)
    if ([string]::IsNullOrWhiteSpace($uri.UserInfo) -or [string]::IsNullOrWhiteSpace($uri.Host)) {
        throw "DATABASE_URL does not look like a valid PostgreSQL connection string."
    }

    $dbName = $uri.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($dbName)) {
        throw "DATABASE_URL is missing a database name."
    }

    return "postgresql://$($uri.UserInfo)@localhost:$LocalPort/$dbName"
}

function Read-InputValue {
    param(
        [string]$Prompt,
        [string]$Default = ""
    )

    $suffix = if ($Default) { " [$Default]" } else { "" }
    $value = Read-Host "$Prompt$suffix"
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }
    return $value.Trim()
}

function Write-EnvFile {
    param(
        [string]$Path,
        [string]$DatabaseUrl
    )

    $folder = Split-Path -Parent $Path
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder | Out-Null
    }

    Set-Content -LiteralPath $Path -Value "DATABASE_URL=$DatabaseUrl" -Encoding ASCII
}

$sourceDatabaseUrl = Get-RepoDatabaseUrl
$sourceUri = [Uri](Normalize-PostgresUrl $sourceDatabaseUrl)

$ec2Host = Read-InputValue -Prompt "EC2 public DNS or IP" -Default "ec2-34-239-30-179.compute-1.amazonaws.com"
$sshUser = Read-InputValue -Prompt "SSH username" -Default "ec2-user"
$keyPath = Read-InputValue -Prompt "Path to your .pem key file"
$localPortText = Read-InputValue -Prompt "Local port to bind" -Default "5432"

if (-not (Test-Path $keyPath)) {
    throw "Key file not found: $keyPath"
}

[int]$localPort = $localPortText
if ($localPort -le 0) {
    throw "Local port must be a positive number."
}

$localDatabaseUrl = New-LocalDatabaseUrl -SourceUrl $sourceDatabaseUrl -LocalPort $localPort

Write-EnvFile -Path (Join-Path $root "backend\.env.local") -DatabaseUrl $localDatabaseUrl
Write-EnvFile -Path (Join-Path $root "client-api\.env.local") -DatabaseUrl $localDatabaseUrl

$sshExe = (Get-Command ssh -ErrorAction Stop).Source
$remoteDbPort = if ($sourceUri.Port -gt 0) { $sourceUri.Port } else { 5432 }
$forwardSpec = "$localPort`:$($sourceUri.Host):$remoteDbPort"
$sshArgs = @(
    "-i", $keyPath,
    "-N",
    "-L", $forwardSpec,
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "$sshUser@$ec2Host"
)

Start-Process -FilePath $sshExe -ArgumentList $sshArgs -WindowStyle Normal | Out-Null

Write-Host ""
Write-Host "SSH tunnel started in a new window." -ForegroundColor Green
Write-Host "Local DB override files written:" -ForegroundColor Green
Write-Host "  $(Join-Path $root 'backend\.env.local')" -ForegroundColor Gray
Write-Host "  $(Join-Path $root 'client-api\.env.local')" -ForegroundColor Gray
Write-Host ""
Write-Host "Now start your apps normally from the repo root:" -ForegroundColor Cyan
Write-Host "  .\launch.ps1" -ForegroundColor Gray
Write-Host "  or .\start-server.ps1 / .\start-client.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Keep the SSH tunnel window open while you work." -ForegroundColor Yellow