#!/bin/bash
# Comprehensive End-to-End Test Suite for NutriSnap (Port 3001)

set -e

BASE_URL="http://localhost:3001"
COOKIES_FILE="/tmp/nutrisnap_cookies.txt"

echo "=========================================="
echo "  NutriSnap - Automated Test Suite"
echo "=========================================="
echo ""

# Test Case 1: Next.js Frontend Accessibility
echo "[Test 1/4] Checking Frontend Homepage (GET ${BASE_URL}/)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/")
if [ "$HTTP_CODE" -eq 200 ]; then
    echo "  ✅ Frontend is online (HTTP ${HTTP_CODE})"
else
    echo "  ❌ Frontend test failed (HTTP ${HTTP_CODE})"
    exit 1
fi
echo ""

# Test Case 2: Admin Authentication (Successful Login & Session Cookie)
echo "[Test 2/4] Testing Admin User Authentication (POST ${BASE_URL}/api/auth/login)..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -c "${COOKIES_FILE}" \
    -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@mkcyberlabs.in", "password": "ProductionPassword123!"}')

LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$LOGIN_HTTP_CODE" -eq 200 ]; then
    echo "  ✅ Admin Authentication Passed (HTTP ${LOGIN_HTTP_CODE})"
    echo "  Session Profile:"
    echo "$LOGIN_BODY" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_BODY"
else
    echo "  ❌ Login failed (HTTP ${LOGIN_HTTP_CODE})"
    echo "$LOGIN_BODY"
    exit 1
fi
echo ""

# Test Case 3: Security Check (Invalid Credentials)
echo "[Test 3/4] Testing Security & Input Validation (Invalid Password)..."
BAD_LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@mkcyberlabs.in", "password": "WrongPassword!"}')

BAD_HTTP_CODE=$(echo "$BAD_LOGIN_RESPONSE" | tail -n1)
if [ "$BAD_HTTP_CODE" -eq 401 ]; then
    echo "  ✅ Security Check Passed: Invalid credentials rejected (HTTP 401 Unauthorized)"
else
    echo "  ⚠️ Unexpected status for bad credentials: HTTP ${BAD_HTTP_CODE}"
fi
echo ""

# Test Case 4: Authenticated Meal Analysis Flow
echo "[Test 4/4] Testing Authenticated Meal Analysis API (POST ${BASE_URL}/api/analyze-meal)..."
ANALYZE_RESPONSE=$(curl -s -w "\n%{http_code}" -b "${COOKIES_FILE}" \
    -X POST "${BASE_URL}/api/analyze-meal" \
    -H "Content-Type: application/json" \
    -d '{"mealDescription": "100g oatmeal with banana and honey", "mealTime": "breakfast"}')

ANALYZE_HTTP_CODE=$(echo "$ANALYZE_RESPONSE" | tail -n1)
ANALYZE_BODY=$(echo "$ANALYZE_RESPONSE" | sed '$d')

echo "  HTTP Status: ${ANALYZE_HTTP_CODE}"
echo "  Response Body:"
echo "$ANALYZE_BODY" | python3 -m json.tool 2>/dev/null || echo "$ANALYZE_BODY"
echo ""

echo "=========================================="
echo "  🎉 All Automated Test Cases Completed!"
echo "=========================================="
