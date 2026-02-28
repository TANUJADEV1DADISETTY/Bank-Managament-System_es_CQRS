# verification_script.ps1
$baseUrl = "http://localhost:8080/api"

function Invoke-ApiRequest {
    param (
        [string]$Method,
        [string]$Path,
        [object]$Body
    )
    $url = "$baseUrl$Path"
    $headers = @{ "Content-Type" = "application/json" }
    $bodyJson = $Body | ConvertTo-Json -Compress
    
    try {
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers
        } else {
            $response = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -Body $bodyJson
        }
        return $response
    } catch {
        Write-Error "Request to $url failed: $_"
        return $null
    }
}

Write-Host "--- Starting API Verification ---" -ForegroundColor Cyan

# 1. Create Account
$accountId = "acc_" + (New-Guid).ToString().Substring(0,8)
Write-Host "Creating account: $accountId"
$createBody = @{
    accountId = $accountId
    ownerName = "John Doe"
    initialBalance = 1000
    currency = "USD"
}
$res = Invoke-ApiRequest -Method "POST" -Path "/accounts" -Body $createBody
Write-Host "Create Account Response: $($res.message)"

# 2. Deposit
$txId1 = "tx_" + (New-Guid).ToString().Substring(0,8)
Write-Host "Depositing $500"
$depositBody = @{
    amount = 500
    description = "Salary deposit"
    transactionId = $txId1
}
$res = Invoke-ApiRequest -Method "POST" -Path "/accounts/$accountId/deposit" -Body $depositBody
Write-Host "Deposit Response: $($res.message)"

# 3. Withdraw
$txId2 = "tx_" + (New-Guid).ToString().Substring(0,8)
Write-Host "Withdrawing $200"
$withdrawBody = @{
    amount = 200
    description = "ATM Withdrawal"
    transactionId = $txId2
}
$res = Invoke-ApiRequest -Method "POST" -Path "/accounts/$accountId/withdraw" -Body $withdrawBody
Write-Host "Withdraw Response: $($res.message)"

# 4. Get Details
Write-Host "Fetching account details"
$details = Invoke-ApiRequest -Method "GET" -Path "/accounts/$accountId"
Write-Host "Balance: $($details.balance) $($details.currency)"
if ($details.balance -eq 1300) {
    Write-Host "Balance MATCHES expected value ($1300)" -ForegroundColor Green
} else {
    Write-Host "Balance MISMATCH! Expected $1300, got $($details.balance)" -ForegroundColor Red
}

# 5. Get Events
Write-Host "Fetching account events"
$events = Invoke-ApiRequest -Method "GET" -Path "/accounts/$accountId/events"
Write-Host "Total events: $($events.Count)"

# 6. Rebuild Projections
Write-Host "Triggering projection rebuild"
$res = Invoke-ApiRequest -Method "POST" -Path "/projections/rebuild"
Write-Host "Rebuild Response: $($res.message)"

# Wait for rebuild (background process)
Start-Sleep -Seconds 2

# Verify after rebuild
Write-Host "Fetching account details after rebuild"
$details2 = Invoke-ApiRequest -Method "GET" -Path "/accounts/$accountId"
Write-Host "Balance after rebuild: $($details2.balance)"

if ($details2.balance -eq 1300) {
    Write-Host "Rebuild consistency check PASSED" -ForegroundColor Green
} else {
    Write-Host "Rebuild consistency check FAILED" -ForegroundColor Red
}

Write-Host "--- Verification Finished ---" -ForegroundColor Cyan
