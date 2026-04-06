#!/bin/bash
# =============================================================================
# IP Intelligence Module - CURL Test Scripts
# =============================================================================
# Тесты для проверки интеграции с патентными API:
# - USPTO Patent API
# - PatentsView
# - EPO OPS
# - WIPO PATENTSCOPE
#
# Использование:
#   ./test_patent_api.sh
#
# Или по отдельности:
#   source test_patent_api.sh
#   test_precheck_us
# =============================================================================

# =============================================================================
# CONFIGURATION
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:8000}"
API_PREFIX="/api/v1"

# =============================================================================
# AUTH - Получение токена
# =============================================================================

login() {
    local email="${1:-user@example.com}"
    local password="${2:-password}"

    echo "📝 Login as: $email"

    RESPONSE=$(curl -s -X POST "${BASE_URL}${API_PREFIX}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"${email}\",
            \"password\": \"${password}\"
        }")

    TOKEN=$(echo "$RESPONSE" | jq -r '.access_token // empty')

    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo "❌ Login failed: $RESPONSE"
        return 1
    fi

    echo "✅ Token received: ${TOKEN:0:20}..."
    export TOKEN
}

# =============================================================================
# HEALTH CHECK
# =============================================================================

test_health() {
    echo -e "\n🏥 Health Check"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X GET "${BASE_URL}${API_PREFIX}/patents/health" | jq .
}

# =============================================================================
# PATENT PRECHECK TESTS
# =============================================================================

test_precheck_us() {
    echo -e "\n🇺🇸 USPTO Patent Precheck"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "patent_number": "US20230012345",
            "country_code": "US",
            "kind_code": "A1",
            "search_mode": "exact",
            "include_analytics": true
        }' | jq .
}

test_precheck_us_real() {
    echo -e "\n🇺🇸 USPTO Patent Precheck (Real Patent)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Реальный патент для теста
    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "patent_number": "US10658764",
            "country_code": "US",
            "search_mode": "exact",
            "include_analytics": true
        }' | jq .
}

test_precheck_ep() {
    echo -e "\n🇪🇺 EPO OPS Patent Precheck"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "patent_number": "EP3502692",
            "country_code": "EP",
            "kind_code": "A1",
            "search_mode": "exact",
            "include_analytics": false
        }' | jq .
}

test_precheck_wo() {
    echo -e "\n🌍 WIPO PCT Patent Precheck"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "patent_number": "WO2020123456",
            "country_code": "WO",
            "search_mode": "exact",
            "include_analytics": false
        }' | jq .
}

test_precheck_not_found() {
    echo -e "\n❌ Patent Precheck (Not Found)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "patent_number": "US999999999",
            "country_code": "US",
            "search_mode": "exact"
        }' | jq .
}

test_precheck_cached() {
    echo -e "\n💾 Patent Precheck (Cached Response)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Повторный запрос должен вернуть cached: true"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "patent_number": "US20230012345",
            "country_code": "US"
        }' | jq '.cached, .primary_source'
}

# =============================================================================
# INTERNATIONAL SEARCH TESTS
# =============================================================================

test_search_all() {
    echo -e "\n🔍 International Search (All Sources)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/search/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "query": "artificial intelligence battery management",
            "countries": ["US", "EP", "WO"],
            "date_from": "2020-01-01",
            "date_to": "2026-01-01",
            "page": 1,
            "per_page": 10
        }' | jq .
}

test_search_us_only() {
    echo -e "\n🇺🇸 Search US Patents Only"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/search/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "query": "machine learning neural network",
            "countries": ["US"],
            "page": 1,
            "per_page": 5
        }' | jq '.total, .sources_queried, .results[].title'
}

test_search_ep_only() {
    echo -e "\n🇪🇺 Search EP Patents Only"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/search/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "query": "electric vehicle charging",
            "countries": ["EP"],
            "page": 1,
            "per_page": 5
        }' | jq .
}

test_search_wo_only() {
    echo -e "\n🌍 Search PCT/WO Patents Only"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/search/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "query": "solar panel efficiency",
            "countries": ["WO"],
            "date_from": "2022-01-01",
            "page": 1,
            "per_page": 5
        }' | jq .
}

test_search_pagination() {
    echo -e "\n📄 Search with Pagination"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    echo "Page 1:"
    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/search/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "query": "blockchain",
            "page": 1,
            "per_page": 3
        }' | jq '.page, .per_page, .total_pages, (.results | length)'

    echo -e "\nPage 2:"
    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/search/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "query": "blockchain",
            "page": 2,
            "per_page": 3
        }' | jq '.page, .per_page, .total_pages, (.results | length)'
}

# =============================================================================
# IP CLAIM ENRICHMENT TESTS
# =============================================================================

test_enrich_claim() {
    local claim_id="${1:-550e8400-e29b-41d4-a716-446655440000}"

    echo -e "\n📋 Enrich IP Claim: $claim_id"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/ip-claims/${claim_id}/enrich/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "force_refresh": false,
            "sources": ["USPTO", "PATENTSVIEW"]
        }' | jq .
}

test_enrich_claim_force() {
    local claim_id="${1:-550e8400-e29b-41d4-a716-446655440000}"

    echo -e "\n🔄 Enrich IP Claim (Force Refresh): $claim_id"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/ip-claims/${claim_id}/enrich/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "force_refresh": true,
            "sources": ["USPTO"]
        }' | jq .
}

# =============================================================================
# ERROR HANDLING TESTS
# =============================================================================

test_no_auth() {
    echo -e "\n🚫 Test Without Authentication (Expect 401)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
        -H "Content-Type: application/json" \
        -d '{
            "patent_number": "US20230012345",
            "country_code": "US"
        }' | head -20
}

test_invalid_patent_number() {
    echo -e "\n❌ Test Invalid Patent Number Format"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "patent_number": "",
            "country_code": "US"
        }' | jq .
}

test_invalid_country_code() {
    echo -e "\n❌ Test Invalid Country Code"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "patent_number": "123456",
            "country_code": "XX"
        }' | jq .
}

# =============================================================================
# PERFORMANCE TEST
# =============================================================================

test_performance() {
    echo -e "\n⚡ Performance Test (10 Parallel Requests)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    TIME_START=$(date +%s.%N)

    for i in {1..10}; do
        curl -s -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d '{
                "patent_number": "US20230012345",
                "country_code": "US"
            }' > /dev/null &
    done

    wait

    TIME_END=$(date +%s.%N)
    ELAPSED=$(echo "$TIME_END - $TIME_START" | bc)

    echo "⏱️  10 requests completed in ${ELAPSED}s"
    echo "📊 Average: $(echo "scale=3; $ELAPSED / 10" | bc)s per request"
}

# =============================================================================
# RATE LIMITING TEST
# =============================================================================

test_rate_limit() {
    echo -e "\n🚦 Rate Limiting Test (20 Rapid Requests)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    SUCCESS=0
    FAILED=0

    for i in {1..20}; do
        RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/response_$i.json \
            -X POST "${BASE_URL}${API_PREFIX}/patents/precheck/international" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d '{
                "patent_number": "US2023001234'$i'",
                "country_code": "US"
            }')

        if [ "$RESPONSE" = "200" ]; then
            ((SUCCESS++))
        else
            ((FAILED++))
            echo "Request $i: HTTP $RESPONSE"
        fi
    done

    echo "✅ Success: $SUCCESS"
    echo "❌ Failed: $FAILED"
}

# =============================================================================
# DIRECT API TESTS (Without IPChain wrapper)
# =============================================================================

test_uspto_direct() {
    echo -e "\n🇺🇸 Direct USPTO API Test"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local api_key="${USPTO_API_KEY:-}"

    if [ -z "$api_key" ]; then
        echo "⚠️  USPTO_API_KEY not set, trying without key..."
    fi

    curl -s -w "\nHTTP Status: %{http_code}\n" \
        -H "Accept: application/json" \
        -H "X-API-Key: ${api_key}" \
        "https://api.uspto.gov/v1/patents/grant/10658764" | jq .
}

test_patentsview_direct() {
    echo -e "\n📊 Direct PatentsView API Test"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    curl -s -X POST "https://api.patentsview.org/v1/patents" \
        -H "Content-Type: application/json" \
        -d '{
            "included_fields": "all",
            "criteria": {
                "patent_number": "10658764"
            }
        }' | jq '.patents | length, .patents[0].title'
}

test_epo_ops_direct() {
    echo -e "\n🇪🇺 Direct EPO OPS API Test"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  Requires OAuth2 token (not implemented in curl)"

    # Пример запроса без токена (вернёт ошибку)
    curl -s -w "\nHTTP Status: %{http_code}\n" \
        -H "Accept: application/xml" \
        "https://ops.epo.org/rest-services/published-data/publication/epo/3502692/A1" | head -20
}

test_wipo_direct() {
    echo -e "\n🌍 Direct WIPO PATENTSCOPE API Test"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local api_key="${WIPO_API_KEY:-}"

    curl -s -w "\nHTTP Status: %{http_code}\n" \
        -H "Accept: application/json" \
        -H "X-API-Key: ${api_key}" \
        "https://patentscope.wipo.int/api/v2/publications/WO2020123456" | jq .
}

# =============================================================================
# MAIN - RUN ALL TESTS
# =============================================================================

run_all_tests() {
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║     IP Intelligence Module - Full Test Suite              ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "Base URL: ${BASE_URL}"
    echo "Timestamp: $(date)"

    # Health check first
    test_health

    # Login
    echo -e "\n🔐 Authentication"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    login || {
        echo "❌ Cannot proceed without authentication"
        echo "💡 Create a test user or use valid credentials"
        return 1
    }

    # Precheck tests
    echo -e "\n📋 Running Precheck Tests..."
    test_precheck_us
    test_precheck_us_real
    test_precheck_not_found
    test_precheck_cached

    # Search tests
    echo -e "\n🔍 Running Search Tests..."
    test_search_all
    test_search_us_only
    test_search_wo_only

    # Error handling
    echo -e "\n🚫 Running Error Tests..."
    test_no_auth
    test_invalid_patent_number

    echo -e "\n╔═══════════════════════════════════════════════════════════╗"
    echo "║                    Tests Complete ✅                          ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
}

run_direct_api_tests() {
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║     Direct External API Tests (No IPChain)                ║"
    echo "╚═══════════════════════════════════════════════════════════╝"

    test_uspto_direct
    test_patentsview_direct
    test_epo_ops_direct
    test_wipo_direct
}

# =============================================================================
# SCRIPT ENTRY POINT
# =============================================================================

case "${1:-all}" in
    health)
        test_health
        ;;
    login)
        login "${2:-}" "${3:-}"
        ;;
    precheck)
        login && test_precheck_us
        ;;
    search)
        login && test_search_all
        ;;
    enrich)
        login && test_enrich_claim "${2:-}"
        ;;
    direct)
        run_direct_api_tests
        ;;
    performance)
        login && test_performance
        ;;
    rate-limit)
        login && test_rate_limit
        ;;
    all)
        run_all_tests
        ;;
    *)
        echo "Usage: $0 {health|login|precheck|search|enrich|direct|performance|rate-limit|all}"
        echo ""
        echo "Commands:"
        echo "  health      - Health check endpoint"
        echo "  login       - Get auth token"
        echo "  precheck    - Test patent precheck"
        echo "  search      - Test international search"
        echo "  enrich      - Test IP claim enrichment"
        echo "  direct      - Test external APIs directly"
        echo "  performance - Performance test (10 parallel)"
        echo "  rate-limit  - Rate limiting test (20 requests)"
        echo "  all         - Run full test suite"
        exit 1
        ;;
esac
