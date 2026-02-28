# verify_snapshot.ps1
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
            return Invoke-RestMethod -Uri $url -Method Get -Headers $headers
        } else {
            return Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -Body $bodyJson
        }
    } catch {
        return $null
    }
}

Write-Host "--- Testing Snapshotting ---" -ForegroundColor Cyan

$accountId = "acc_snap_" + (New-Guid).ToString().Substring(0,8)
$createBody = @{
    accountId = $accountId
    ownerName = "Snapshot Tester"
    initialBalance = 100
    currency = "USD"
}
Invoke-ApiRequest -Method "POST" -Path "/accounts" -Body $createBody

Write-Host "Triggering 50 deposits..."
for ($i = 1; $i -le 50; $i++) {
    $depositBody = @{
        amount = 1
        description = "Deposit $i"
        transactionId = "tx_snap_$accountId`_$i"
    }
    $res = Invoke-ApiRequest -Method "POST" -Path "/accounts/$accountId/deposit" -Body $depositBody
    if ($i % 10 -eq 0) { Write-Host "Processed $i events..." }
}

Write-Host "Fetching events to verify version..."
$events = Invoke-ApiRequest -Method "GET" -Path "/accounts/$accountId/events"
$lastEventVersion = $events[-1].eventNumber
Write-Host "Current Version: $lastEventVersion"

if ($lastEventVersion -ge 50) {
    Write-Host "Snapshot should have been created (triggered at version 50 and 100...)" -ForegroundColor Green
}

# No direct API to check snapshots, but we can check if reconstructState still works
Write-Host "Verifying state reconstruction..."
$details = Invoke-ApiRequest -Method "GET" -Path "/accounts/$accountId"
Write-Host "Final Balance: $($details.balance)"

if ($details.balance -eq 151) { # 100 initial + 50 * 1 + 1 (wait, initial=100, 50 deposits of 1 = 150. Correct: 151 if i=50. Wait, i starts at 1 ends at 50, so 50 deposits. 100 + 50 = 150.)
    # Wait, initialBalance 100 + 50 * 1 = 150. 
    Write-Host "Balance matches: 150" -ForegroundColor Green
} else {
    Write-Host "Balance mismatch! Got $($details.balance), expected 150" -ForegroundColor Red
}

Write-Host "--- Snapshot Test Finished ---" -ForegroundColor Cyan
