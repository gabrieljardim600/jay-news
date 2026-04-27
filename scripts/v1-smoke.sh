#!/usr/bin/env bash
# v1-smoke.sh — smoke test da API M2M /api/v1.
#
# Uso:
#   BASE=https://jay-news.vercel.app \
#   SVCKEY=<service key plain> \
#   ACCOUNT_A=<uuid arena> \
#   ACCOUNT_B=<uuid teste1> \
#   USER=<uuid auth.users gabriel> \
#   bash scripts/v1-smoke.sh
#
# Testa:
#   - Auth (key valida, key invalida, headers faltando)
#   - Isolamento cross-account em GET (read) e PATCH (write)
#   - RBAC (viewer nao pode escrever)
#   - Lista de endpoints v1 retornando 200

set -euo pipefail

BASE="${BASE:-https://jay-news.vercel.app}"
SVCKEY="${SVCKEY:?SVCKEY env var required}"
ACCOUNT_A="${ACCOUNT_A:?ACCOUNT_A required}"
ACCOUNT_B="${ACCOUNT_B:?ACCOUNT_B required}"
USER="${USER:?USER required}"

PASS=0
FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $name (HTTP $actual)"
    PASS=$((PASS+1))
  else
    echo "  ✗ $name (expected $expected, got $actual)"
    FAIL=$((FAIL+1))
  fi
}

hit() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

echo "=== Auth ==="
check "GET /health w/ valid key" 200 \
  "$(hit "$BASE/api/v1/health" -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: $ACCOUNT_A")"
check "GET /health w/ wrong key → 401" 401 \
  "$(hit "$BASE/api/v1/health" -H "X-Service: social" -H "X-Service-Key: WRONG" -H "X-Account-Id: $ACCOUNT_A")"
check "GET /health missing X-Account-Id → 400" 400 \
  "$(hit "$BASE/api/v1/health" -H "X-Service: social" -H "X-Service-Key: $SVCKEY")"
check "GET /health bad uuid → 400" 400 \
  "$(hit "$BASE/api/v1/health" -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: not-uuid")"

echo "=== RBAC ==="
check "POST /digest-configs as viewer → 403" 403 \
  "$(hit "$BASE/api/v1/digest-configs" -X POST -H "Content-Type: application/json" \
    -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: $ACCOUNT_A" \
    -H "X-User-Role: viewer" -H "X-User-Id: $USER" -d '{"name":"x"}')"
check "POST /digest-configs missing X-User-Id → 400" 400 \
  "$(hit "$BASE/api/v1/digest-configs" -X POST -H "Content-Type: application/json" \
    -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: $ACCOUNT_A" -d '{"name":"x"}')"

echo "=== Cross-account isolation ==="
# Cria config no account A
CREATE_RES=$(curl -s "$BASE/api/v1/digest-configs" -X POST -H "Content-Type: application/json" \
  -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: $ACCOUNT_A" -H "X-User-Id: $USER" \
  -d '{"name":"smoke-test-config"}')
CFG_ID=$(echo "$CREATE_RES" | python -c "import sys,json;print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")
if [ -z "$CFG_ID" ]; then
  echo "  ✗ Failed to create config in account A: $CREATE_RES"
  FAIL=$((FAIL+1))
else
  check "GET account-A config from account-A → 200" 200 \
    "$(hit "$BASE/api/v1/digest-configs/$CFG_ID" \
      -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: $ACCOUNT_A")"
  check "GET account-A config from account-B → 404" 404 \
    "$(hit "$BASE/api/v1/digest-configs/$CFG_ID" \
      -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: $ACCOUNT_B")"
  check "PATCH account-A config from account-B → 404" 404 \
    "$(hit "$BASE/api/v1/digest-configs/$CFG_ID" -X PATCH -H "Content-Type: application/json" \
      -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: $ACCOUNT_B" -H "X-User-Id: $USER" \
      -d '{"name":"hijack"}')"
  check "DELETE (cleanup) → 200" 200 \
    "$(hit "$BASE/api/v1/digest-configs/$CFG_ID" -X DELETE \
      -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: $ACCOUNT_A" -H "X-User-Id: $USER")"
fi

echo "=== Read endpoints (200) ==="
for path in \
  "/digests?limit=5" \
  "/digest-configs" \
  "/markets" \
  "/gossip/topics" \
  "/gossip/sources" \
  "/gossip/feed?limit=5" \
  "/gossip/dossiers?limit=5" \
  "/social/voices" \
  "/social/crowd" \
  "/social/feed?limit=5" \
  "/watchlist" \
  "/brands" \
  "/briefing-profiles" \
  "/query/runs"
do
  check "GET $path" 200 \
    "$(hit "$BASE/api/v1$path" -H "X-Service: social" -H "X-Service-Key: $SVCKEY" -H "X-Account-Id: $ACCOUNT_A")"
done

echo
echo "=================="
echo "PASS: $PASS  FAIL: $FAIL"
echo "=================="
[ "$FAIL" -eq 0 ]
