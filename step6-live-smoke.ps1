$ErrorActionPreference = "Stop"

$base = "http://127.0.0.1:8101/api/client"
$companies = Invoke-RestMethod -Uri "$base/companies" -Method Get
if (-not $companies -or $companies.Count -eq 0) {
    throw "No companies returned"
}

$candidateCompanyIds = @()
foreach ($co in $companies) {
    $candidateId = $co.company_id
    $candidateProducts = Invoke-RestMethod -Uri "$base/catalog/products?company_id=$candidateId" -Method Get
    $candidateServices = Invoke-RestMethod -Uri "$base/catalog/services?company_id=$candidateId" -Method Get
    if (($candidateProducts -and $candidateProducts.Count -gt 0) -or ($candidateServices -and $candidateServices.Count -gt 0)) {
        $candidateCompanyIds += $candidateId
    }
}

if (-not $candidateCompanyIds -or $candidateCompanyIds.Count -eq 0) {
    throw "No company with catalog data was found for checkout smoke."
}

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$uid = [guid]::NewGuid().ToString("N")
$email = $null
$displayName = "Step6 Runner"
$password = "Step6Pass!123"
$companyId = $null
$fallbackEmail = "maria.garcia@example.com"

foreach ($candidateId in $candidateCompanyIds) {
    $candidateEmail = "step6.$stamp.$uid.$candidateId@example.com"
    $candidateDisplayName = "$displayName $uid"

    $registerBody = @{
        name = $candidateDisplayName
        email = $candidateEmail
        password = $password
        company_id = $candidateId
    } | ConvertTo-Json

    try {
        $null = Invoke-RestMethod -Uri "$base/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
        $companyId = $candidateId
        $email = $candidateEmail
        break
    }
    catch {
        try {
            $resetReqBody = @{
                email = $fallbackEmail
                company_id = $candidateId
            } | ConvertTo-Json
            $resetReq = Invoke-RestMethod -Uri "$base/auth/request-password-reset" -Method Post -ContentType "application/json" -Body $resetReqBody
            if (-not $resetReq.reset_token) {
                Write-Warning "Reset token missing for fallback account at company_id=$candidateId; trying next company."
                continue
            }

            $resetBody = @{
                email = $fallbackEmail
                company_id = $candidateId
                reset_token = $resetReq.reset_token
                new_password = $password
            } | ConvertTo-Json
            Invoke-RestMethod -Uri "$base/auth/reset-password" -Method Post -ContentType "application/json" -Body $resetBody | Out-Null
            $companyId = $candidateId
            $email = $fallbackEmail
            break
        }
        catch {
            Write-Warning "Register/reset fallback failed for company_id=$candidateId; trying next company."
            continue
        }
    }
}

if (-not $companyId -or -not $email) {
    throw "Failed to establish a login account for any company with catalog data."
}

$loginBody = @{
    email = $email
    password = $password
    company_id = $companyId
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $login.access_token
if (-not $login -or [string]::IsNullOrWhiteSpace([string]$token)) {
    throw "Login did not return an access token for company_id=$companyId."
}
$headers = @{ Authorization = "Bearer $token" }

$me = Invoke-RestMethod -Uri "$base/auth/me" -Method Get -Headers $headers
$products = Invoke-RestMethod -Uri "$base/catalog/products?company_id=$companyId" -Method Get
$services = Invoke-RestMethod -Uri "$base/catalog/services?company_id=$companyId" -Method Get

$booking = $null
$serviceForOrder = $null
if ($services -and $services.Count -gt 0) {
    $serviceForOrder = $services[0]
    $from = [DateTime]::UtcNow.AddDays(1).ToString("o")
    $to = [DateTime]::UtcNow.AddDays(7).ToString("o")
    $availabilityUri = "$base/catalog/services/$($serviceForOrder.id)/availability?company_id=$companyId&date_from=$([uri]::EscapeDataString($from))&date_to=$([uri]::EscapeDataString($to))"
    $availability = Invoke-RestMethod -Uri $availabilityUri -Method Get
    $slot = $availability | Where-Object { $_.available -eq $true } | Select-Object -First 1

    if ($slot) {
        $bookingBody = @{
            service_id = $serviceForOrder.id
            appointment_date = $slot.start
            booking_mode = "soft"
            notes = "step6 smoke"
        } | ConvertTo-Json
        $booking = Invoke-RestMethod -Uri "$base/bookings" -Method Post -Headers $headers -ContentType "application/json" -Body $bookingBody
    }
}

Invoke-RestMethod -Uri "$base/cart" -Method Delete -Headers $headers | Out-Null

$items = @()
if ($products -and $products.Count -gt 0) {
    $p = $products[0]
    $parsedProductPrice = 0.0
    if (($null -ne $p.price) -and [double]::TryParse([string]$p.price, [ref]$parsedProductPrice)) {
    $items += @{
        item_id = $p.id
        item_type = "product"
        item_name = $p.name
        unit_price = $parsedProductPrice
        quantity = 1
    }
    }
}

if ($booking -and $serviceForOrder) {
    $items += @{
        item_id = $serviceForOrder.id
        item_type = "service"
        item_name = $serviceForOrder.name
        unit_price = [double]$serviceForOrder.price
        quantity = 1
        booking_id = $booking.id
    }
}

if ($items.Count -eq 0) {
    throw "No order items available for checkout"
}

$checkoutBody = @{
    items = $items
    payment_method = "card"
} | ConvertTo-Json -Depth 6

$checkout = Invoke-RestMethod -Uri "$base/orders/checkout" -Method Post -Headers $headers -ContentType "application/json" -Body $checkoutBody
if (-not $checkout -or [string]::IsNullOrWhiteSpace([string]$checkout.order_id)) {
    Write-Error ("Checkout response missing order_id: " + ($checkout | ConvertTo-Json -Depth 8 -Compress))
    throw "Checkout did not return a valid order_id."
}
$payBody = @{ payment_method = "card" } | ConvertTo-Json
$paid = Invoke-RestMethod -Uri "$base/orders/$($checkout.order_id)/pay" -Method Post -Headers $headers -ContentType "application/json" -Body $payBody
$orders = Invoke-RestMethod -Uri "$base/orders" -Method Get -Headers $headers
$orderItems = Invoke-RestMethod -Uri "$base/orders/$($checkout.order_id)/items" -Method Get -Headers $headers

Write-Output ("step6_company_id=" + $companyId)
Write-Output ("step6_client_email=" + $email)
Write-Output ("step6_me_id=" + $me.id)
Write-Output ("step6_products_count=" + $products.Count)
Write-Output ("step6_services_count=" + $services.Count)
Write-Output ("step6_booking_created=" + [bool]$booking)
Write-Output ("step6_checkout_order_id=" + $checkout.order_id)
Write-Output ("step6_paid_status=" + $paid.status)
Write-Output ("step6_orders_count=" + $orders.Count)
Write-Output ("step6_order_items_count=" + $orderItems.Count)
