$ErrorActionPreference = "Stop"

function Get-EnvFileValue {
	param(
		[string]$Path,
		[string]$Name
	)

	if (-not (Test-Path $Path)) { return $null }

	$pattern = "(?m)^\s*" + [regex]::Escape($Name) + "=(.+)$"
	$match = [regex]::Match((Get-Content -LiteralPath $Path -Raw), $pattern)
	if (-not $match.Success) { return $null }

	return $match.Groups[1].Value.Trim()
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

function New-LocalTunnelDatabaseUrl {
	param(
		[Uri]$RemoteUri,
		[int]$LocalPort
	)

	$dbName = $RemoteUri.AbsolutePath.TrimStart('/')
	if ([string]::IsNullOrWhiteSpace($dbName)) {
		$dbName = 'postgres'
	}

	$query = if ([string]::IsNullOrWhiteSpace($RemoteUri.Query)) { "" } else { $RemoteUri.Query.TrimStart('?') }
	if ([string]::IsNullOrWhiteSpace($query)) {
		$query = if ($RemoteUri.Host -in @("localhost", "127.0.0.1", "::1")) { "sslmode=disable" } else { "sslmode=require" }
	}

	return "postgresql://$($RemoteUri.UserInfo)@localhost:$LocalPort/$($dbName)?$query"
}

function Test-TcpPortOpen {
	param(
		[string]$Address = "127.0.0.1",
		[int]$Port,
		[int]$TimeoutMs = 1000
	)

	$client = New-Object System.Net.Sockets.TcpClient
	try {
		$async = $client.BeginConnect($Address, $Port, $null, $null)
		if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
			return $false
		}
		$client.EndConnect($async)
		return $client.Connected
	}
	catch {
		return $false
	}
	finally {
		$client.Dispose()
	}
}

function Resolve-AwsRegion {
	param(
		[string]$SshHost,
		[string]$RemoteDatabaseHost
	)

	if (-not [string]::IsNullOrWhiteSpace($env:AWS_DB_TUNNEL_REGION)) {
		return $env:AWS_DB_TUNNEL_REGION.Trim()
	}
	if ($RemoteDatabaseHost -match '([a-z]{2}-[a-z]+-\d)') {
		return $matches[1]
	}
	if ($SshHost -match '([a-z]{2}-[a-z]+-\d)') {
		return $matches[1]
	}
	return 'us-east-1'
}

function Invoke-Ec2InstanceConnectAuthorization {
	param(
		[string]$SshHost,
		[string]$SshUser,
		[string]$KeyPath,
		[string]$RemoteDatabaseHost
	)

	$awsExe = (Get-Command aws -ErrorAction SilentlyContinue).Source
	$sshKeygenExe = (Get-Command ssh-keygen -ErrorAction SilentlyContinue).Source
	if ([string]::IsNullOrWhiteSpace($awsExe) -or [string]::IsNullOrWhiteSpace($sshKeygenExe)) {
		return $false
	}

	$region = Resolve-AwsRegion -SshHost $SshHost -RemoteDatabaseHost $RemoteDatabaseHost
	$instanceId = $env:AWS_DB_TUNNEL_INSTANCE_ID
	$availabilityZone = $env:AWS_DB_TUNNEL_AZ

	if ([string]::IsNullOrWhiteSpace($instanceId) -or [string]::IsNullOrWhiteSpace($availabilityZone)) {
		$lookupOutput = & $awsExe ec2 describe-instances `
			--region $region `
			--filters "Name=dns-name,Values=$SshHost" `
			--query "Reservations[0].Instances[0].[InstanceId,Placement.AvailabilityZone]" `
			--output text 2>$null
		if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($lookupOutput)) {
			return $false
		}

		$parts = ($lookupOutput -split "\s+") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
		if ($parts.Count -lt 2) {
			return $false
		}

		$instanceId = $parts[0]
		$availabilityZone = $parts[1]
	}

	$publicKey = & $sshKeygenExe -y -f $KeyPath 2>$null
	if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($publicKey)) {
		return $false
	}

	$tempFile = [System.IO.Path]::GetTempFileName()
	try {
		Set-Content -LiteralPath $tempFile -Value $publicKey -Encoding ASCII
		$sendOutput = & $awsExe ec2-instance-connect send-ssh-public-key `
			--region $region `
			--instance-id $instanceId `
			--availability-zone $availabilityZone `
			--instance-os-user $SshUser `
			--ssh-public-key "file://$tempFile" 2>&1
		if ($LASTEXITCODE -ne 0) {
			return $false
		}

		return (($sendOutput | Out-String) -match '"Success"\s*:\s*true')
	}
	finally {
		Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
	}
}

function Ensure-AwsDbTunnel {
	param(
		[string]$RootPath,
		[string]$DatabaseUrl = $env:DATABASE_URL,
		[string]$RoleName = "Local app",
		[switch]$RequireReady
	)

	$enabledValue = "true"
	if (-not [string]::IsNullOrWhiteSpace($env:AWS_DB_TUNNEL_ENABLED)) {
		$enabledValue = $env:AWS_DB_TUNNEL_ENABLED
	}
	if ($enabledValue.Trim().ToLowerInvariant() -in @("0", "false", "no", "off")) {
		return $false
	}

	$normalizedDatabaseUrl = Normalize-PostgresUrl $DatabaseUrl
	if ([string]::IsNullOrWhiteSpace($normalizedDatabaseUrl)) {
		return $false
	}

	try {
		$localUri = [Uri]$normalizedDatabaseUrl
	}
	catch {
		Write-Host "$RoleName database URL is not a valid PostgreSQL URI; skipping tunnel bootstrap." -ForegroundColor Yellow
		return $false
	}

	if ($localUri.Host -notin @("localhost", "127.0.0.1", "::1")) {
		return $false
	}

	$localPort = if ($localUri.Port -gt 0) { $localUri.Port } else { 5432 }
	if (Test-TcpPortOpen -Port $localPort) {
		return $true
	}

	$rootEnvPath = Join-Path $RootPath ".env"
	$remoteDatabaseUrl = Get-EnvFileValue -Path $rootEnvPath -Name "DATABASE_URL"
	if ([string]::IsNullOrWhiteSpace($remoteDatabaseUrl)) {
		Write-Host "$RoleName expects an AWS tunnel on localhost:$localPort, but the repo root .env does not contain DATABASE_URL." -ForegroundColor Yellow
		return $false
	}

	try {
		$remoteUri = [Uri](Normalize-PostgresUrl $remoteDatabaseUrl)
	}
	catch {
		Write-Host "Root .env DATABASE_URL is not a valid PostgreSQL URI; cannot start the AWS tunnel." -ForegroundColor Yellow
		return $false
	}

	$sshHost = if ([string]::IsNullOrWhiteSpace($env:AWS_DB_TUNNEL_HOST)) { "ec2-34-239-30-179.compute-1.amazonaws.com" } else { $env:AWS_DB_TUNNEL_HOST.Trim() }
	$sshUser = if ([string]::IsNullOrWhiteSpace($env:AWS_DB_TUNNEL_USER)) { "ec2-user" } else { $env:AWS_DB_TUNNEL_USER.Trim() }
	$keyPath = if ([string]::IsNullOrWhiteSpace($env:AWS_DB_TUNNEL_KEY_PATH)) { Join-Path $RootPath "businessmanager-key.pem" } else { $env:AWS_DB_TUNNEL_KEY_PATH.Trim() }

	if (-not (Test-Path $keyPath)) {
		Write-Host "$RoleName expects an AWS DB tunnel, but the SSH key was not found at $keyPath." -ForegroundColor Yellow
		return $false
	}

	$sshExe = (Get-Command ssh -ErrorAction SilentlyContinue).Source
	if ([string]::IsNullOrWhiteSpace($sshExe)) {
		Write-Host "OpenSSH client is not installed, so the AWS DB tunnel could not be started automatically." -ForegroundColor Yellow
		return $false
	}

	$remotePort = if ($remoteUri.Port -gt 0) { $remoteUri.Port } else { 5432 }
	$forwardSpec = "$localPort`:$($remoteUri.Host):$remotePort"
	$env:DATABASE_URL = New-LocalTunnelDatabaseUrl -RemoteUri $remoteUri -LocalPort $localPort
	$authorized = Invoke-Ec2InstanceConnectAuthorization -SshHost $sshHost -SshUser $sshUser -KeyPath $keyPath -RemoteDatabaseHost $remoteUri.Host
	if ($authorized) {
		Write-Host "Authorized SSH key with EC2 Instance Connect for $RoleName." -ForegroundColor Gray
	}
	$sshArgs = @(
		"-i", $keyPath,
		"-N",
		"-L", $forwardSpec,
		"-o", "ExitOnForwardFailure=yes",
		"-o", "BatchMode=yes",
		"-o", "ConnectTimeout=8",
		"-o", "ServerAliveInterval=30",
		"-o", "ServerAliveCountMax=3",
		"-o", "StrictHostKeyChecking=accept-new",
		"$sshUser@$sshHost"
	)

	Write-Host "Starting AWS database tunnel for $RoleName on localhost:$localPort..." -ForegroundColor Cyan
	$sshProcess = Start-Process -FilePath $sshExe -ArgumentList $sshArgs -PassThru -WindowStyle Minimized

	for ($attempt = 0; $attempt -lt 20; $attempt++) {
		if (Test-TcpPortOpen -Port $localPort) {
			Write-Host "AWS database tunnel ready on localhost:$localPort (PID: $($sshProcess.Id))." -ForegroundColor Green
			return $true
		}
		if ($sshProcess.HasExited) {
			break
		}
		Start-Sleep -Milliseconds 500
	}

	$failureMessage = "AWS database tunnel did not become ready on localhost:$localPort. " +
	"Start scripts\\start-db-tunnel.ps1 to reconfigure it, or set AWS_DB_TUNNEL_ENABLED=false if a tunnel is no longer required and DATABASE_URL now points directly to your remote DB."

	if ($sshProcess.HasExited) {
		Write-Host "SSH tunnel process exited early with code $($sshProcess.ExitCode)." -ForegroundColor Yellow
	}

	if ($RequireReady) {
		throw $failureMessage
	}

	Write-Host $failureMessage -ForegroundColor Yellow
	return $false
}