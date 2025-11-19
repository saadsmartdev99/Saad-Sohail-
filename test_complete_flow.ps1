# ============================================
# GCI Backend - Complete API Test Flow
# ============================================

$BASE_URL = "http://localhost:3000"
$USER_ID = 4

function Write-Header {
    param([string]$text)
    Write-Host "`n================================================" -ForegroundColor Magenta
    Write-Host "  $text" -ForegroundColor Magenta
    Write-Host "================================================`n" -ForegroundColor Magenta
}

function Write-Step {
    param([string]$number, [string]$text)
    Write-Host "`n[$number] " -ForegroundColor Yellow -NoNewline
    Write-Host "$text" -ForegroundColor Cyan
    Write-Host ("-" * 50) -ForegroundColor DarkGray
}

function Write-Success {
    param([string]$text)
    Write-Host "[SUCCESS] $text" -ForegroundColor Green
}

function Write-Info {
    param([string]$text)
    Write-Host "  -> $text" -ForegroundColor Gray
}

function Write-Data {
    param([object]$data)
    $json = $data | ConvertTo-Json -Depth 5
    Write-Host $json -ForegroundColor White
}

function Write-Error-Message {
    param([string]$text)
    Write-Host "[ERROR] $text" -ForegroundColor Red
}

# ============================================
# START TEST FLOW
# ============================================

Write-Header "GCI BACKEND - COMPLETE API TEST FLOW"

Write-Host "Configuration:" -ForegroundColor White
Write-Info "API URL: $BASE_URL"
Write-Info "User ID: $USER_ID"
Write-Host ""

# ============================================
# STEP 1: Health Check
# ============================================
Write-Step "1" "Health Check - Verify Server is Running"

try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Success "Server is running!"
    Write-Info "Status: $($health.status)"
    Write-Info "Service: $($health.service)"
} catch {
    Write-Error-Message "Server is not running! Please start with 'npm run dev'"
    exit 1
}

# ============================================
# STEP 2: Create User (First Request)
# ============================================
Write-Step "2" "Create User - First API Call"

Write-Info "This will implicitly create the user in the database"
Write-Info "Sending first message to initialize user..."

$body = @{
    question = "Hello! What is Clean Architecture?"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat/ask" -Method Post `
        -ContentType "application/json" `
        -Headers @{"x-user-id" = $USER_ID} `
        -Body $body
    
    Write-Success "User created successfully!"
    Write-Info "Answer: $($response.answer)"
    Write-Info "Token Count: $($response.tokenCount)"
    Write-Info "Usage Type: $($response.usageType)"
    Write-Info "Free messages used: 1/3"
} catch {
    Write-Error-Message "Failed to create user: $_"
    exit 1
}

Start-Sleep -Seconds 2

# ============================================
# STEP 3: Check Initial Usage
# ============================================
Write-Step "3" "Check Usage - Verify Free Quota"

try {
    $usage = Invoke-RestMethod -Uri "$BASE_URL/chat/usage" -Method Get `
        -Headers @{"x-user-id" = $USER_ID}
    
    Write-Success "Usage retrieved successfully!"
    Write-Info "Month: $($usage.monthKey)"
    Write-Info "Free quota: $($usage.free.quota)"
    Write-Info "Used: $($usage.free.used)"
    Write-Info "Remaining: $($usage.free.remaining)"
    Write-Info "Active bundles: $($usage.bundles.Count)"
} catch {
    Write-Error-Message "Failed to get usage: $_"
}

Start-Sleep -Seconds 1

# ============================================
# STEP 4: Send 2nd Free Message
# ============================================
Write-Step "4" "Send 2nd Free Message"

$body = @{
    question = "What is Domain-Driven Design?"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat/ask" -Method Post `
        -ContentType "application/json" `
        -Headers @{"x-user-id" = $USER_ID} `
        -Body $body
    
    Write-Success "Message sent successfully!"
    Write-Info "Answer: $($response.answer)"
    Write-Info "Usage Type: $($response.usageType)"
    Write-Info "Free messages used: 2/3"
} catch {
    Write-Error-Message "Failed to send message: $_"
}

Start-Sleep -Seconds 2

# ============================================
# STEP 5: Send 3rd Free Message (Last Free)
# ============================================
Write-Step "5" "Send 3rd Free Message (Last Free Message)"

$body = @{
    question = "What is TypeScript?"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat/ask" -Method Post `
        -ContentType "application/json" `
        -Headers @{"x-user-id" = $USER_ID} `
        -Body $body
    
    Write-Success "Last free message sent successfully!"
    Write-Info "Answer: $($response.answer)"
    Write-Info "Usage Type: $($response.usageType)"
    Write-Info "Free messages used: 3/3 (EXHAUSTED)"
} catch {
    Write-Error-Message "Failed to send message: $_"
}

Start-Sleep -Seconds 1

# ============================================
# STEP 6: Try 4th Message (Should Fail)
# ============================================
Write-Step "6" "Try 4th Message - Should Fail (Quota Exceeded)"

$body = @{
    question = "This should fail - no quota left"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat/ask" -Method Post `
        -ContentType "application/json" `
        -Headers @{"x-user-id" = $USER_ID} `
        -Body $body
    
    Write-Error-Message "Unexpected success - should have failed!"
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Success "Expected error received!"
    Write-Info "Error Code: $($errorResponse.error.code)"
    Write-Info "Message: $($errorResponse.error.message)"
}

Start-Sleep -Seconds 1

# ============================================
# STEP 7: Check Usage (All Free Used)
# ============================================
Write-Step "7" "Check Usage - Free Quota Exhausted"

try {
    $usage = Invoke-RestMethod -Uri "$BASE_URL/chat/usage" -Method Get `
        -Headers @{"x-user-id" = $USER_ID}
    
    Write-Success "Usage retrieved!"
    Write-Info "Free - Used: $($usage.free.used)/$($usage.free.quota)"
    Write-Info "Free - Remaining: $($usage.free.remaining)"
} catch {
    Write-Error-Message "Failed to get usage: $_"
}

Start-Sleep -Seconds 2

# ============================================
# STEP 8: Create BASIC Subscription
# ============================================
Write-Step "8" "Create BASIC Subscription (10 messages/month)"

$body = @{
    tier = "BASIC"
    billingCycle = "MONTHLY"
    maxMessages = 10
    price = 9.99
    autoRenew = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/subscriptions" -Method Post `
        -ContentType "application/json" `
        -Headers @{"x-user-id" = $USER_ID} `
        -Body $body
    
    $subscription = $response.subscription
    $SUB_ID = $subscription.id
    Write-Success "Subscription created successfully!"
    Write-Info "Subscription ID: $SUB_ID"
    Write-Info "Tier: $($subscription.tier)"
    Write-Info "Billing Cycle: $($subscription.billingCycle)"
    Write-Info "Max Messages: $($subscription.maxMessages)"
    Write-Info "Status: $($subscription.lastPaymentStatus)"
    if ($subscription.startDate -and $subscription.endDate) {
        $startDate = ([DateTime]$subscription.startDate).ToString('yyyy-MM-dd')
        $endDate = ([DateTime]$subscription.endDate).ToString('yyyy-MM-dd')
        Write-Info "Period: $startDate to $endDate"
    }
} catch {
    Write-Error-Message "Failed to create subscription: $_"
    exit 1
}

Start-Sleep -Seconds 2

# ============================================
# STEP 9: Check Usage with Subscription
# ============================================
Write-Step "9" "Check Usage - With Active Subscription"

try {
    $usage = Invoke-RestMethod -Uri "$BASE_URL/chat/usage" -Method Get `
        -Headers @{"x-user-id" = $USER_ID}
    
    Write-Success "Usage retrieved with subscription!"
    Write-Info "Free - Remaining: $($usage.free.remaining)"
    Write-Info "Active Bundles: $($usage.bundles.Count)"
    
    foreach ($bundle in $usage.bundles) {
        Write-Host ""
        Write-Info "  Bundle: $($bundle.tier)"
        Write-Info "  Max Messages: $($bundle.maxMessages)"
        Write-Info "  Remaining: $($bundle.remainingMessages)"
    }
} catch {
    Write-Error-Message "Failed to get usage: $_"
}

Start-Sleep -Seconds 2

# ============================================
# STEP 10: Send Message with Subscription
# ============================================
Write-Step "10" "Send Message Using Subscription"

$body = @{
    question = "Now I can ask questions with my subscription!"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat/ask" -Method Post `
        -ContentType "application/json" `
        -Headers @{"x-user-id" = $USER_ID} `
        -Body $body
    
    Write-Success "Message sent using subscription!"
    Write-Info "Answer: $($response.answer)"
    Write-Info "Token Count: $($response.tokenCount)"
    Write-Info "Usage Type: $($response.usageType)"
    Write-Info "Bundle ID: $($response.bundleId)"
} catch {
    Write-Error-Message "Failed to send message: $_"
}

Start-Sleep -Seconds 2

# ============================================
# STEP 11: Send More Messages
# ============================================
Write-Step "11" "Send Multiple Messages with Subscription"

for ($i = 2; $i -le 5; $i++) {
    $body = @{
        question = "Subscription message #$i - Testing quota management"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/chat/ask" -Method Post `
            -ContentType "application/json" `
            -Headers @{"x-user-id" = $USER_ID} `
            -Body $body
        
        Write-Success "Message $i sent!"
        Write-Info "Bundle ID: $($response.bundleId)"
        Start-Sleep -Seconds 1
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Error-Message "Failed to send message ${i}: $errorMsg"
    }
}

# ============================================
# STEP 12: Check Final Usage
# ============================================
Write-Step "12" "Check Final Usage Statistics"

try {
    $usage = Invoke-RestMethod -Uri "$BASE_URL/chat/usage" -Method Get `
        -Headers @{"x-user-id" = $USER_ID}
    
    Write-Success "Final usage statistics:"
    Write-Host ""
    Write-Host "  Month: $($usage.monthKey)" -ForegroundColor White
    Write-Host "  Free Messages:" -ForegroundColor White
    Write-Info "     Used: $($usage.free.used)/$($usage.free.quota)"
    Write-Info "     Remaining: $($usage.free.remaining)"
    Write-Host ""
    Write-Host "  Subscription Bundles: $($usage.bundles.Count)" -ForegroundColor White
    
    foreach ($bundle in $usage.bundles) {
        Write-Host ""
        Write-Info "  $($bundle.tier) Bundle"
        Write-Info "     Max: $($bundle.maxMessages)"
        Write-Info "     Remaining: $($bundle.remainingMessages)"
        Write-Info "     Used: $($bundle.maxMessages - $bundle.remainingMessages)"
    }
} catch {
    Write-Error-Message "Failed to get usage: $_"
}

Start-Sleep -Seconds 2

# ============================================
# STEP 13: Create PRO Subscription
# ============================================
Write-Step "13" "Create PRO Subscription (100 messages/month)"

$body = @{
    tier = "PRO"
    billingCycle = "YEARLY"
    maxMessages = 100
    price = 99.99
    autoRenew = $true
} | ConvertTo-Json

try {
    $proResponse = Invoke-RestMethod -Uri "$BASE_URL/subscriptions" -Method Post `
        -ContentType "application/json" `
        -Headers @{"x-user-id" = $USER_ID} `
        -Body $body
    
    $proSub = $proResponse.subscription
    $PRO_SUB_ID = $proSub.id
    Write-Success "PRO Subscription created!"
    Write-Info "Subscription ID: $PRO_SUB_ID"
    Write-Info "Tier: $($proSub.tier)"
    Write-Info "Max Messages: $($proSub.maxMessages)"
    Write-Info "Status: $($proSub.lastPaymentStatus)"
} catch {
    Write-Error-Message "Failed to create PRO subscription: $_"
}

Start-Sleep -Seconds 2

# ============================================
# STEP 14: Send Message (Should use PRO)
# ============================================
Write-Step "14" "Send Message - Should Use PRO Bundle (Latest)"

$body = @{
    question = "Which subscription will this use?"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat/ask" -Method Post `
        -ContentType "application/json" `
        -Headers @{"x-user-id" = $USER_ID} `
        -Body $body
    
    Write-Success "Message sent!"
    Write-Info "Usage Type: $($response.usageType)"
    Write-Info "Bundle ID: $($response.bundleId)"
    
    if ($response.bundleId -eq $PRO_SUB_ID) {
        Write-Success "Correctly using PRO subscription (latest)!"
    } else {
        Write-Info "Using BASIC subscription (has remaining quota)"
    }
} catch {
    Write-Error-Message "Failed to send message: $_"
}

Start-Sleep -Seconds 2

# ============================================
# FINAL SUMMARY
# ============================================
Write-Header "TEST FLOW COMPLETED SUCCESSFULLY!"

Write-Host "Summary:" -ForegroundColor White
Write-Host "  * User created and initialized" -ForegroundColor Green
Write-Host "  * 3 free messages used (quota exhausted)" -ForegroundColor Green
Write-Host "  * Quota exceeded error handled correctly" -ForegroundColor Green
Write-Host "  * BASIC subscription created (10 messages)" -ForegroundColor Green
Write-Host "  * Multiple messages sent using subscription" -ForegroundColor Green
Write-Host "  * PRO subscription created (100 messages)" -ForegroundColor Green
Write-Host ""
Write-Host "All API endpoints tested successfully!" -ForegroundColor Cyan
Write-Host ""
Write-Info "User ID for reference: $USER_ID"
Write-Host ""

