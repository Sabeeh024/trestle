#!/usr/bin/env bash
# Smoke test for a running stack: does the product work end to end, and are the production protections in place?
# It talks to the stack the way a browser does, over HTTPS, using --resolve so *.localhost names need no DNS.
#
#   scripts/smoke.sh                       # the local stack at trestle.localhost
#   DOMAIN=staging.example.com RESOLVE=0 scripts/smoke.sh    # a deployed one (real DNS, real certificate)
#
# It needs demo data (the `seed` service), signs in as the seeded owner, and cleans up what it creates.
set -u

DOMAIN="${DOMAIN:-trestle.localhost}"
PASSWORD="${SEED_PASSWORD:-trestle-dev-1}"
EMAIL="${SMOKE_EMAIL:-jordan.kim@trestle.io}"
MARKETING="https://$DOMAIN"
APP="https://app.$DOMAIN"
ADMIN="https://admin.$DOMAIN"

# A local certificate authority is not trusted by this machine, and local names resolve to this machine.
CURL=(curl -s --max-time 20)
if [ "${RESOLVE:-1}" = "1" ]; then
  CURL+=(-k --resolve "$DOMAIN:443:127.0.0.1" --resolve "app.$DOMAIN:443:127.0.0.1" --resolve "admin.$DOMAIN:443:127.0.0.1")
fi

failures=0
pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; failures=$((failures + 1)); }
check() { # description, condition result (0 = pass)
  if [ "$2" -eq 0 ]; then pass "$1"; else fail "$1"; fi
}
contains() { printf '%s' "$1" | grep -qi -- "$2"; }

status() { "${CURL[@]}" -o /dev/null -w '%{http_code}' "$@"; }
headers() { "${CURL[@]}" -sI "$@" | tr -d '\r'; }

echo "Marketing site ($MARKETING)"
[ "$(status "$MARKETING/en")" = "200" ]; check "home page responds" $?
h=$(headers "$MARKETING/en")
contains "$h" "x-frame-options: deny"; check "clickjacking protection header" $?
contains "$h" "strict-transport-security"; check "HSTS header" $?
contains "$h" "x-powered-by"; [ $? -ne 0 ]; check "framework is not advertised" $?

echo "Product app ($APP)"
[ "$(status "$APP/en/login")" = "200" ]; check "login page responds" $?
h=$(headers "$APP/en/login")
contains "$h" "content-security-policy-report-only: .*nonce-"; check "CSP with a per-request nonce" $?
loc=$(headers "$APP/en/dashboard" | grep -i '^location:' || true)
contains "$loc" "/en/login"; check "signed-out visitors are sent to sign in" $?

echo "Admin panel and API ($ADMIN)"
[ "$("${CURL[@]}" "$ADMIN/health")" = '{"ok":true}' ]; check "API health (database reachable)" $?
body=$("${CURL[@]}" "$ADMIN/users")
contains "$body" "Trestle Admin"; check "admin panel served from the API's origin (client-side route)" $?
h=$(headers "$ADMIN/")
contains "$h" "content-security-policy-report-only"; check "admin panel has its own CSP" $?
h=$(headers "$ADMIN/api/projects")
contains "$h" "cache-control: private, no-store"; check "API responses are not cacheable" $?
contains "$h" "default-src 'none'"; check "API has a deny-all CSP" $?

echo "Admin sign-in with a cookie session"
jar=$(mktemp)
login=$("${CURL[@]}" -D - -c "$jar" -X POST "$ADMIN/api/auth/login" -H 'content-type: application/json' -H 'x-auth-mode: cookie' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | tr -d '\r')
contains "$login" "set-cookie: __Host-trestle_session="; check "session cookie has the __Host- prefix" $?
contains "$login" "set-cookie:.*httponly"; check "cookie is HttpOnly" $?
contains "$login" "set-cookie:.*secure"; check "cookie is Secure" $?
contains "$login" '"token":null'; check "the token is not given to the page" $?
[ "$(status -b "$jar" "$ADMIN/api/auth/me")" = "200" ]; check "the cookie authenticates later requests" $?
write() { status -b "$jar" -X PATCH "$ADMIN/api/auth/me" -H 'content-type: application/json' -H "Origin: $1" \
  -d "{\"name\":\"Jordan Kim\",\"email\":\"$EMAIL\"}"; }
[ "$(write "$ADMIN")" = "200" ]; check "a write from the panel's own origin is accepted" $?
[ "$(write "https://evil.example")" = "403" ]; check "a write from another origin is refused" $?
[ "$(status -b "$jar" -X POST "$ADMIN/api/auth/logout" -H "Origin: $ADMIN")" = "204" ]; check "sign-out succeeds" $?
[ "$(status -b "$jar" "$ADMIN/api/auth/me")" = "401" ]; check "the session is revoked on the server" $?
rm -f "$jar"

echo "Product app, signed in"
token=$("${CURL[@]}" -X POST "$ADMIN/api/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$token" ]; check "token sign-in (what the product app's server uses)" $?
page=$("${CURL[@]}" -H "Cookie: __Host-trestle_session=$token" "$APP/en/dashboard")
contains "$page" "Jordan"; check "dashboard renders the signed-in user's data from the API" $?

echo "Data round trip"
created=$("${CURL[@]}" -X POST "$ADMIN/api/projects" -H "Authorization: Bearer $token" -H 'content-type: application/json' -d '{"name":"Smoke test project"}')
id=$(printf '%s' "$created" | sed -n 's/.*"data":{"id":"\([^"]*\)".*/\1/p')
[ -n "$id" ]; check "create a project" $?
[ "$(status -H "Authorization: Bearer $token" "$ADMIN/api/projects/$id")" = "200" ]; check "read it back" $?
[ "$(status -X DELETE -H "Authorization: Bearer $token" "$ADMIN/api/projects/$id")" = "204" ]; check "delete it" $?
"${CURL[@]}" -X POST "$ADMIN/api/auth/logout" -H "Authorization: Bearer $token" -o /dev/null

echo
if [ "$failures" -eq 0 ]; then echo "Smoke test passed."; else echo "Smoke test FAILED: $failures check(s)."; fi
exit "$failures"
