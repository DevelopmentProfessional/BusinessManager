$ErrorActionPreference = "Stop"

$base = "http://127.0.0.1:8100/api/v1"

function Invoke-JsonPost($uri, $bodyObj, $headers = @{}) {
    $body = $bodyObj | ConvertTo-Json -Depth 8
    return Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Headers $headers -Body $body
}

$null = Invoke-RestMethod -Uri "$base/auth/initialize" -Method Get

$loginPayload = @{ username = "admin"; password = "admin123" }
$login = $null

try {
    $login = Invoke-JsonPost "$base/auth/login" $loginPayload
}
catch {
    throw "Manager smoke login failed for configured admin credentials. Update credentials or reset via an authorized backend workflow before rerunning."
}

$token = $login.access_token
$headers = @{ Authorization = "Bearer $token" }

$me = Invoke-RestMethod -Uri "$base/auth/me" -Method Get -Headers $headers
$perms = Invoke-RestMethod -Uri "$base/auth/me/permissions" -Method Get -Headers $headers
$revenue = Invoke-RestMethod -Uri "$base/reports/revenue" -Method Get -Headers $headers

Write-Output ("manager_me_username=" + $me.username)
Write-Output ("manager_role=" + $me.role)
Write-Output ("manager_permissions_count=" + $perms.Count)
Write-Output ("manager_revenue_labels_count=" + $revenue.labels.Count)
Write-Output ("manager_revenue_datasets_count=" + $revenue.datasets.Count)
