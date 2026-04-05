# =============================================================================
# IP Intelligence Module - CURL Test Scripts (PowerShell)
# =============================================================================
# Тесты для проверки интеграции с патентными API
#
# Использование:
#   .\test_patent_api.ps1
#   .\test_patent_api.ps1 -Test precheck
#   .\test_patent_api.ps1 -Test all
# =============================================================================

param(
    [ValidateSet('health', 'login', 'precheck', 'search', 'enrich', 'direct', 'performance', 'all')]
    [string]$Test = 'all',
    
    [string]$BaseUrl = 'http://localhost:8000',
    
    [string]$Email = 'user@example.com',
    
    [string]$Password = 'password'
)

$API_PREFIX = '/api/v1'
$TOKEN = $null

# =============================================================================
# Helper Functions
# =============================================================================

function Write-Header {
    param([string]$Text)
    Write-Host "`n$Text" -ForegroundColor Cyan
    Write-Host ('=' * 60) -ForegroundColor DarkGray
}

function Write-Success {
    param([string]$Text)
    Write-Host "✅ $Text" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Text)
    Write-Host "❌ $Text" -ForegroundColor Red
}

# =============================================================================
# AUTH - Получение токена
# =============================================================================

function Login {
    Write-Header "📝 Login as: $Email"
    
    $body = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "${BaseUrl}${API_PREFIX}/auth/login" `
            -Method Post `
            -ContentType 'application/json' `
            -Body $body `
            -ErrorAction Stop
        
        if ($response.access_token) {
            $script:TOKEN = $response.access_token
            Write-Success "Token received: $($TOKEN.Substring(0, [Math]::Min(20, $TOKEN.Length)))..."
            return $true
        } else {
            Write-Error-Custom "Login failed: $response"
            return $false
        }
    } catch {
        Write-Error-Custom "Login error: $($_.Exception.Message)"
        return $false
    }
}

# =============================================================================
# HEALTH CHECK
# =============================================================================

function Test-Health {
    Write-Header "🏥 Health Check"
    
    try {
        $response = Invoke-RestMethod -Uri "${BaseUrl}${API_PREFIX}/patents/health" `
            -Method Get `
            -ContentType 'application/json'
        
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Error-Custom "Health check failed: $($_.Exception.Message)"
    }
}

# =============================================================================
# PATENT PRECHECK TESTS
# =============================================================================

function Test-PrecheckUS {
    Write-Header "🇺🇸 USPTO Patent Precheck"
    
    $body = @{
        patent_number = "US20230012345"
        country_code = "US"
        kind_code = "A1"
        search_mode = "exact"
        include_analytics = $true
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "precheck/international" -body $body
}

function Test-PrecheckUS-Real {
    Write-Header "🇺🇸 USPTO Patent Precheck (Real Patent)"
    
    $body = @{
        patent_number = "US10658764"
        country_code = "US"
        search_mode = "exact"
        include_analytics = $true
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "precheck/international" -body $body
}

function Test-PrecheckEP {
    Write-Header "🇪🇺 EPO OPS Patent Precheck"
    
    $body = @{
        patent_number = "EP3502692"
        country_code = "EP"
        kind_code = "A1"
        search_mode = "exact"
        include_analytics = $false
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "precheck/international" -body $body
}

function Test-PrecheckWO {
    Write-Header "🌍 WIPO PCT Patent Precheck"
    
    $body = @{
        patent_number = "WO2020123456"
        country_code = "WO"
        search_mode = "exact"
        include_analytics = $false
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "precheck/international" -body $body
}

function Test-PrecheckNotFound {
    Write-Header "❌ Patent Precheck (Not Found)"
    
    $body = @{
        patent_number = "US999999999"
        country_code = "US"
        search_mode = "exact"
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "precheck/international" -body $body
}

function Test-PrecheckCached {
    Write-Header "💾 Patent Precheck (Cached Response)"
    Write-Host "Повторный запрос должен вернуть cached: true"
    
    $body = @{
        patent_number = "US20230012345"
        country_code = "US"
    } | ConvertTo-Json
    
    $response = Invoke-PatentRequest -endpoint "precheck/international" -body $body -ReturnResponse
    
    Write-Host "Cached: $($response.cached)" -ForegroundColor Yellow
    Write-Host "Primary Source: $($response.primary_source)" -ForegroundColor Yellow
}

# =============================================================================
# INTERNATIONAL SEARCH TESTS
# =============================================================================

function Test-SearchAll {
    Write-Header "🔍 International Search (All Sources)"
    
    $body = @{
        query = "artificial intelligence battery management"
        countries = @("US", "EP", "WO")
        date_from = "2020-01-01"
        date_to = "2026-01-01"
        page = 1
        per_page = 10
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "search/international" -body $body
}

function Test-SearchUSOnly {
    Write-Header "🇺🇸 Search US Patents Only"
    
    $body = @{
        query = "machine learning neural network"
        countries = @("US")
        page = 1
        per_page = 5
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "search/international" -body $body
}

function Test-SearchWOOnly {
    Write-Header "🌍 Search PCT/WO Patents Only"
    
    $body = @{
        query = "solar panel efficiency"
        countries = @("WO")
        date_from = "2022-01-01"
        page = 1
        per_page = 5
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "search/international" -body $body
}

function Test-SearchPagination {
    Write-Header "📄 Search with Pagination"
    
    $body1 = @{
        query = "blockchain"
        page = 1
        per_page = 3
    } | ConvertTo-Json
    
    Write-Host "Page 1:" -ForegroundColor Cyan
    $response1 = Invoke-PatentRequest -endpoint "search/international" -body $body1 -ReturnResponse
    Write-Host "  Page: $($response1.page), Per Page: $($response1.per_page), Results: $($response1.results.Count)"
    
    $body2 = @{
        query = "blockchain"
        page = 2
        per_page = 3
    } | ConvertTo-Json
    
    Write-Host "Page 2:" -ForegroundColor Cyan
    $response2 = Invoke-PatentRequest -endpoint "search/international" -body $body2 -ReturnResponse
    Write-Host "  Page: $($response2.page), Per Page: $($response2.per_page), Results: $($response2.results.Count)"
}

# =============================================================================
# IP CLAIM ENRICHMENT TESTS
# =============================================================================

function Test-EnrichClaim {
    param([string]$ClaimId = "550e8400-e29b-41d4-a716-446655440000")
    
    Write-Header "📋 Enrich IP Claim: $ClaimId"
    
    $body = @{
        force_refresh = $false
        sources = @("USPTO", "PATENTSVIEW")
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "ip-claims/$ClaimId/enrich/international" -body $body
}

function Test-EnrichClaimForce {
    param([string]$ClaimId = "550e8400-e29b-41d4-a716-446655440000")
    
    Write-Header "🔄 Enrich IP Claim (Force Refresh): $ClaimId"
    
    $body = @{
        force_refresh = $true
        sources = @("USPTO")
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "ip-claims/$ClaimId/enrich/international" -body $body
}

# =============================================================================
# ERROR HANDLING TESTS
# =============================================================================

function Test-NoAuth {
    Write-Header "🚫 Test Without Authentication (Expect 401)"
    
    $body = @{
        patent_number = "US20230012345"
        country_code = "US"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "${BaseUrl}${API_PREFIX}/patents/precheck/international" `
            -Method Post `
            -ContentType 'application/json' `
            -Body $body `
            -ErrorAction Stop
        
        $response | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "HTTP Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "Expected: 401 Unauthorized"
    }
}

function Test-InvalidPatentNumber {
    Write-Header "❌ Test Invalid Patent Number Format"
    
    $body = @{
        patent_number = ""
        country_code = "US"
    } | ConvertTo-Json
    
    Invoke-PatentRequest -endpoint "precheck/international" -body $body
}

# =============================================================================
# PERFORMANCE TEST
# =============================================================================

function Test-Performance {
    Write-Header "⚡ Performance Test (10 Parallel Requests)"
    
    $startTime = Get-Date
    
    $jobs = 1..10 | ForEach-Object {
        $body = @{
            patent_number = "US20230012345"
            country_code = "US"
        } | ConvertTo-Json
        
        Start-Job -ScriptBlock {
            param($url, $token, $body)
            Invoke-RestMethod -Uri $url `
                -Method Post `
                -ContentType 'application/json' `
                -Headers @{ Authorization = "Bearer $token" } `
                -Body $body
        } -ArgumentList "${BaseUrl}${API_PREFIX}/patents/precheck/international", $TOKEN, $body
    }
    
    # Wait for all jobs
    $jobs | Wait-Job | Receive-Job
    
    $endTime = Get-Date
    $elapsed = ($endTime - $startTime).TotalSeconds
    
    Write-Host "⏱️  10 requests completed in ${elapsed}s" -ForegroundColor Green
    Write-Host "📊 Average: $([Math]::Round($elapsed / 10, 3))s per request" -ForegroundColor Green
}

# =============================================================================
# DIRECT API TESTS
# =============================================================================

function Test-USPTO-Direct {
    Write-Header "🇺🇸 Direct USPTO API Test"
    
    $apiKey = $env:USPTO_API_KEY
    
    $headers = @{
        'Accept' = 'application/json'
    }
    
    if ($apiKey) {
        $headers['X-API-Key'] = $apiKey
    } else {
        Write-Host "⚠️  USPTO_API_KEY not set, trying without key..." -ForegroundColor Yellow
    }
    
    try {
        $response = Invoke-RestMethod -Uri 'https://api.uspto.gov/v1/patents/grant/10658764' `
            -Method Get `
            -Headers $headers `
            -ErrorAction Stop
        
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Error-Custom "USPTO API error: $($_.Exception.Message)"
    }
}

function Test-PatentsView-Direct {
    Write-Header "📊 Direct PatentsView API Test"
    
    $body = @{
        included_fields = "all"
        criteria = @{
            patent_number = "10658764"
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri 'https://api.patentsview.org/v1/patents' `
            -Method Post `
            -ContentType 'application/json' `
            -Body $body `
            -ErrorAction Stop
        
        Write-Host "Patents found: $($response.patents.Count)"
        if ($response.patents.Count -gt 0) {
            Write-Host "Title: $($response.patents[0].title)"
        }
    } catch {
        Write-Error-Custom "PatentsView API error: $($_.Exception.Message)"
    }
}

function Test-EPO-Direct {
    Write-Header "🇪🇺 Direct EPO OPS API Test"
    Write-Host "⚠️  Requires OAuth2 token (not implemented in curl)" -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri 'https://ops.epo.org/rest-services/published-data/publication/epo/3502692/A1' `
            -Method Get `
            -Headers @{ 'Accept' = 'application/xml' } `
            -ErrorAction Stop
        
        Write-Host $response
    } catch {
        Write-Host "HTTP Status: $($_.Exception.Response.StatusCode)"
    }
}

function Test-WIPO-Direct {
    Write-Header "🌍 Direct WIPO PATENTSCOPE API Test"
    
    $apiKey = $env:WIPO_API_KEY
    
    $headers = @{
        'Accept' = 'application/json'
    }
    
    if ($apiKey) {
        $headers['X-API-Key'] = $apiKey
    }
    
    try {
        $response = Invoke-RestMethod -Uri 'https://patentscope.wipo.int/api/v2/publications/WO2020123456' `
            -Method Get `
            -Headers $headers `
            -ErrorAction Stop
        
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Error-Custom "WIPO API error: $($_.Exception.Message)"
    }
}

# =============================================================================
# Helper: Invoke Patent Request
# =============================================================================

function Invoke-PatentRequest {
    param(
        [string]$endpoint,
        [string]$body,
        [switch]$ReturnResponse
    )
    
    try {
        $response = Invoke-RestMethod -Uri "${BaseUrl}${API_PREFIX}/patents/$endpoint" `
            -Method Post `
            -ContentType 'application/json' `
            -Headers @{ Authorization = "Bearer $TOKEN" } `
            -Body $body `
            -ErrorAction Stop
        
        if ($ReturnResponse) {
            return $response
        } else {
            $response | ConvertTo-Json -Depth 10
        }
    } catch {
        Write-Error-Custom "API error: $($_.Exception.Message)"
    }
}

# =============================================================================
# MAIN - RUN ALL TESTS
# =============================================================================

function Run-AllTests {
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║     IP Intelligence Module - Full Test Suite              ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Base URL: $BaseUrl"
    Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    
    # Health check
    Test-Health
    
    # Login
    Write-Header "🔐 Authentication"
    if (!(Login)) {
        Write-Error-Custom "Cannot proceed without authentication"
        return
    }
    
    # Precheck tests
    Write-Header "📋 Running Precheck Tests..."
    Test-PrecheckUS
    Test-PrecheckUS-Real
    Test-PrecheckNotFound
    Test-PrecheckCached
    
    # Search tests
    Write-Header "🔍 Running Search Tests..."
    Test-SearchAll
    Test-SearchUSOnly
    Test-SearchWOOnly
    
    # Error handling
    Write-Header "🚫 Running Error Tests..."
    Test-NoAuth
    Test-InvalidPatentNumber
    
    Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                    Tests Complete ✅                          ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
}

function Run-DirectApiTests {
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║     Direct External API Tests (No IPChain)                ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    
    Test-USPTO-Direct
    Test-PatentsView-Direct
    Test-EPO-Direct
    Test-WIPO-Direct
}

# =============================================================================
# SCRIPT ENTRY POINT
# =============================================================================

switch ($Test) {
    'health' { Test-Health }
    'login' { Login }
    'precheck' { Login; Test-PrecheckUS }
    'search' { Login; Test-SearchAll }
    'enrich' { Login; Test-EnrichClaim }
    'direct' { Run-DirectApiTests }
    'performance' { Login; Test-Performance }
    'all' { Run-AllTests }
    default {
        Write-Host "Usage: .\test_patent_api.ps1 [-Test <test_name>]"
        Write-Host ""
        Write-Host "Test names:"
        Write-Host "  health      - Health check endpoint"
        Write-Host "  login       - Get auth token"
        Write-Host "  precheck    - Test patent precheck"
        Write-Host "  search      - Test international search"
        Write-Host "  enrich      - Test IP claim enrichment"
        Write-Host "  direct      - Test external APIs directly"
        Write-Host "  performance - Performance test (10 parallel)"
        Write-Host "  all         - Run full test suite (default)"
    }
}
