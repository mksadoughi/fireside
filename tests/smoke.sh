#!/usr/bin/env bash
#
# Fireside Smoke Test
# ===================
# Tests the real server end-to-end, exactly the way users and external tools will use it.
# Run this with a fresh server (no existing setup) and Ollama running.
#
# Usage:
#   ./tests/smoke.sh                   # defaults to http://localhost:7654
#   ./tests/smoke.sh http://host:port  # custom server URL
#
# What it tests:
#   1. Health check
#   2. Setup flow (create admin)
#   3. Login + session cookie
#   4. Create invite + register new user
#   5. Create API key
#   6. OpenAI-compatible /v1/models (curl)
#   7. OpenAI-compatible /v1/chat/completions (curl)
#   8. Python openai client (if installed)
#   9. LangChain client (if installed)
#  10. Server reset (cleanup)

set -euo pipefail

BASE_URL="${1:-http://localhost:7654}"
PASS=0
FAIL=0
SESSION_COOKIE=""
API_KEY=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() { ((PASS++)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { ((FAIL++)); echo -e "  ${RED}✗${NC} $1: $2"; }
skip() { echo -e "  ${YELLOW}⊘${NC} $1 (skipped: $2)"; }

echo ""
echo "Fireside Smoke Test"
echo "==================="
echo "Server: $BASE_URL"
echo ""

# ---------------------------------------------------------------
# 1. Health check
# ---------------------------------------------------------------
echo "── Health ──"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$HTTP_CODE" = "200" ]; then
    pass "GET /health → 200"
else
    fail "GET /health" "expected 200, got $HTTP_CODE"
    echo ""
    echo "Server is not reachable. Make sure Fireside is running at $BASE_URL"
    exit 1
fi

# ---------------------------------------------------------------
# 2. Setup
# ---------------------------------------------------------------
echo "── Setup ──"
SETUP_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/setup" \
    -H "Content-Type: application/json" \
    -d '{"username":"testadmin","password":"testpass123","server_name":"SmokeTest"}')
SETUP_CODE=$(echo "$SETUP_RESP" | tail -1)
SETUP_BODY=$(echo "$SETUP_RESP" | sed '$d')

if [ "$SETUP_CODE" = "201" ]; then
    pass "POST /api/setup → 201 (admin created)"
elif [ "$SETUP_CODE" = "409" ]; then
    fail "POST /api/setup" "409 Conflict — server already set up. Reset it first or use a fresh data dir."
    echo "  Hint: start server with --data-dir /tmp/fireside-smoke-test"
    exit 1
else
    fail "POST /api/setup" "expected 201, got $SETUP_CODE"
    exit 1
fi

# ---------------------------------------------------------------
# 3. Login
# ---------------------------------------------------------------
echo "── Auth ──"
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

LOGIN_CODE=$(curl -s -o /dev/null -c "$COOKIE_JAR" -w "%{http_code}" "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"testadmin","password":"testpass123"}')

# Extract session cookie value from cookie jar file
SESSION_COOKIE=$(awk '/session/ {print $NF}' "$COOKIE_JAR")

if [ "$LOGIN_CODE" = "200" ] && [ -n "$SESSION_COOKIE" ]; then
    pass "POST /api/auth/login → 200 + session cookie"
else
    fail "POST /api/auth/login" "code=$LOGIN_CODE, cookie=$SESSION_COOKIE"
    exit 1
fi

# Verify session works with /api/auth/me
ME_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/me" \
    -b "session=$SESSION_COOKIE")
if [ "$ME_CODE" = "200" ]; then
    pass "GET /api/auth/me → 200 (session valid)"
else
    fail "GET /api/auth/me" "expected 200, got $ME_CODE"
fi

# ---------------------------------------------------------------
# 4. Invite + Register
# ---------------------------------------------------------------
echo "── Invites ──"
INVITE_RESP=$(curl -s "$BASE_URL/api/admin/invites" \
    -b "session=$SESSION_COOKIE" \
    -H "Content-Type: application/json" \
    -d '{"max_uses":1}')
INVITE_TOKEN=$(echo "$INVITE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['invite']['token'])" 2>/dev/null || echo "")

if [ -n "$INVITE_TOKEN" ]; then
    pass "POST /api/admin/invites → got token"
else
    fail "POST /api/admin/invites" "no token in response: $INVITE_RESP"
fi

# Validate invite
if [ -n "$INVITE_TOKEN" ]; then
    VALIDATE_RESP=$(curl -s "$BASE_URL/api/invite/$INVITE_TOKEN")
    IS_VALID=$(echo "$VALIDATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid',''))" 2>/dev/null || echo "")
    if [ "$IS_VALID" = "True" ]; then
        pass "GET /api/invite/{token} → valid=true"
    else
        fail "GET /api/invite/{token}" "expected valid=true: $VALIDATE_RESP"
    fi
fi

# Register new user via invite
if [ -n "$INVITE_TOKEN" ]; then
    REG_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"token\":\"$INVITE_TOKEN\",\"username\":\"smokeuser\",\"password\":\"userpass123\"}")
    if [ "$REG_CODE" = "201" ]; then
        pass "POST /api/auth/register → 201 (user created via invite)"
    else
        fail "POST /api/auth/register" "expected 201, got $REG_CODE"
    fi
fi

# ---------------------------------------------------------------
# 5. API Key
# ---------------------------------------------------------------
echo "── API Keys ──"
KEY_RESP=$(curl -s "$BASE_URL/api/admin/api-keys" \
    -b "session=$SESSION_COOKIE" \
    -H "Content-Type: application/json" \
    -d '{"name":"smoke-test"}')
API_KEY=$(echo "$KEY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])" 2>/dev/null || echo "")

if [ -n "$API_KEY" ] && [[ "$API_KEY" == sk-* ]]; then
    pass "POST /api/admin/api-keys → got sk-*** key"
else
    fail "POST /api/admin/api-keys" "no api_key in response: $KEY_RESP"
fi

# ---------------------------------------------------------------
# 6. OpenAI: GET /v1/models
# ---------------------------------------------------------------
echo "── OpenAI API ──"
if [ -n "$API_KEY" ]; then
    MODELS_RESP=$(curl -s "$BASE_URL/v1/models" \
        -H "Authorization: Bearer $API_KEY")
    MODEL_OBJ=$(echo "$MODELS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('object',''))" 2>/dev/null || echo "")

    if [ "$MODEL_OBJ" = "list" ]; then
        pass "GET /v1/models → object='list'"
    else
        fail "GET /v1/models" "expected object=list: $MODELS_RESP"
    fi

    # Without auth → 401
    NO_AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/v1/models")
    if [ "$NO_AUTH_CODE" = "401" ]; then
        pass "GET /v1/models (no auth) → 401"
    else
        fail "GET /v1/models (no auth)" "expected 401, got $NO_AUTH_CODE"
    fi
fi

# ---------------------------------------------------------------
# 7. OpenAI: POST /v1/chat/completions
# ---------------------------------------------------------------
if [ -n "$API_KEY" ]; then
    # Get the first available model name
    MODEL_NAME=$(echo "$MODELS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') else '')" 2>/dev/null || echo "")

    if [ -n "$MODEL_NAME" ]; then
        CHAT_RESP=$(curl -s --max-time 120 "$BASE_URL/v1/chat/completions" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"model\":\"$MODEL_NAME\",\"messages\":[{\"role\":\"user\",\"content\":\"Say hi in exactly 3 words.\"}],\"stream\":false}")
        CHAT_OBJ=$(echo "$CHAT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('object',''))" 2>/dev/null || echo "")
        CHAT_CONTENT=$(echo "$CHAT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'][:50])" 2>/dev/null || echo "")
        FINISH=$(echo "$CHAT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0].get('finish_reason',''))" 2>/dev/null || echo "")

        if [ "$CHAT_OBJ" = "chat.completion" ] && [ -n "$CHAT_CONTENT" ] && [ "$FINISH" = "stop" ]; then
            pass "POST /v1/chat/completions → object='chat.completion', finish_reason='stop'"
        else
            fail "POST /v1/chat/completions" "object=$CHAT_OBJ finish=$FINISH content=$CHAT_CONTENT"
        fi
    else
        skip "POST /v1/chat/completions" "no models available — download one first"
    fi
fi

# ---------------------------------------------------------------
# 8. Python openai client
# ---------------------------------------------------------------
echo "── Python Clients ──"
if [ -n "$API_KEY" ] && [ -n "$MODEL_NAME" ] && python3 -c "import openai" 2>/dev/null; then
    PYRESULT=$(python3 -c "
from openai import OpenAI
client = OpenAI(base_url='$BASE_URL/v1', api_key='$API_KEY')
resp = client.chat.completions.create(
    model='$MODEL_NAME',
    messages=[{'role':'user','content':'Say ok'}],
    max_tokens=10,
)
print(resp.choices[0].message.content[:50])
" 2>&1) && {
        pass "Python openai client → got response: ${PYRESULT:0:40}"
    } || {
        fail "Python openai client" "$PYRESULT"
    }
elif ! python3 -c "import openai" 2>/dev/null; then
    skip "Python openai client" "openai package not installed (pip install openai)"
else
    skip "Python openai client" "no model available"
fi

# ---------------------------------------------------------------
# 9. LangChain
# ---------------------------------------------------------------
if [ -n "$API_KEY" ] && [ -n "$MODEL_NAME" ] && python3 -c "from langchain_openai import ChatOpenAI" 2>/dev/null; then
    LCRESULT=$(python3 -c "
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(base_url='$BASE_URL/v1', api_key='$API_KEY', model='$MODEL_NAME', max_tokens=10)
resp = llm.invoke('Say ok')
print(resp.content[:50])
" 2>&1) && {
        pass "LangChain ChatOpenAI → got response: ${LCRESULT:0:40}"
    } || {
        fail "LangChain ChatOpenAI" "$LCRESULT"
    }
elif ! python3 -c "from langchain_openai import ChatOpenAI" 2>/dev/null; then
    skip "LangChain ChatOpenAI" "not installed (pip install langchain-openai)"
else
    skip "LangChain ChatOpenAI" "no model available"
fi

# ---------------------------------------------------------------
# 10. Cleanup: reset server
# ---------------------------------------------------------------
echo "── Cleanup ──"
RESET_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/admin/reset" \
    -X POST \
    -b "session=$SESSION_COOKIE")
if [ "$RESET_CODE" = "200" ]; then
    pass "POST /api/admin/reset → 200 (server wiped)"
else
    # Reset may fail if not localhost — that's expected through tunnel
    skip "POST /api/admin/reset" "code=$RESET_CODE (only works from localhost)"
fi

# ---------------------------------------------------------------
# Summary
# ---------------------------------------------------------------
echo ""
echo "═══════════════════════════════"
TOTAL=$((PASS + FAIL))
echo -e "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC} / $TOTAL total"
echo "═══════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
