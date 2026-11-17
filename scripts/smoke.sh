#!/usr/bin/env bash
# Smoke test for a running stack: does the product work end to end, and are the production protections in place?
# It talks to the stack the way a browser does, over HTTPS, using --resolve so *.localhost names need no DNS.
#
#   scripts/smoke.sh                                  # the local stack at trestle.localhost
#   MARKETING_URL=https://m.vercel.app APP_URL=https://a.vercel.app ADMIN_URL=https://api.onrender.com scripts/smoke.sh
#                                                     # a deployed environment (real DNS, real certificates)
#
# SMOKE_LEVEL=full (default) signs in as the seeded owner and creates and deletes a project, so it needs demo data
# (staging). SMOKE_LEVEL=basic only reads: pages, headers and health, with no sign-in, which is safe in production.
# EXPECT_VERSION=<git sha> also requires /health to report that build, proving the new version is the one answering.
# WAIT_SECONDS=<n> waits for the API first (a free-tier service takes about a minute to wake up).
set -u

DOMAIN="${DOMAIN:-trestle.localhost}"
PASSWORD="${SEED_PASSWORD:-trestle-dev-1}"
EMAIL="${SMOKE_EMAIL:-jordan.kim@trestle.io}"
MARKETING="${MARKETING_URL:-https://$DOMAIN}"
APP="${APP_URL:-https://app.$DOMAIN}"
ADMIN="${ADMIN_URL:-https://admin.$DOMAIN}"
MARKETING="${MARKETING%/}"; APP="${APP%/}"; ADMIN="${ADMIN%/}"
LEVEL="${SMOKE_LEVEL:-full}"
# Local names need a local resolver and a locally-trusted certificate; real deployments need neither.
if [ -n "${ADMIN_URL:-}" ]; then RESOLVE="${RESOLVE:-0}"; else RESOLVE="${RESOLVE:-1}"; fi

# A local certificate authority is not trusted by this machine, and local names resolve to this machine.
CURL=(curl -s --max-time 20)
if [ "$RESOLVE" = "1" ]; then
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

# Every API operation is one JSON document POSTed to /api/graphql. Each helper takes the query and the variables as
# JSON (or null), then any extra curl arguments (a cookie jar, an Authorization header...).
gql_body() { printf '{"query":"%s","variables":%s}' "${1//\"/\\\"}" "$2"; }
gql()         { local body; body=$(gql_body "$1" "$2"); shift 2; "${CURL[@]}" -X POST "$ADMIN/api/graphql" -H 'content-type: application/json' -d "$body" "$@"; }
gql_status()  { local body; body=$(gql_body "$1" "$2"); shift 2; status -X POST "$ADMIN/api/graphql" -H 'content-type: application/json' -d "$body" "$@"; }
gql_full()    { local body; body=$(gql_body "$1" "$2"); shift 2; "${CURL[@]}" -D - -X POST "$ADMIN/api/graphql" -H 'content-type: application/json' -d "$body" "$@" | tr -d '\r'; }
LOGIN='mutation Login($input: LoginInput!) { login(input: $input) { token user { id } } }'
LOGIN_VARS="{\"input\":{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}}"
headers() { "${CURL[@]}" -sI "$@" | tr -d '\r'; }

if [ -n "${WAIT_SECONDS:-}" ]; then
  echo "Waiting up to ${WAIT_SECONDS}s for the API at $ADMIN"
  waited=0
  until "${CURL[@]}" "$ADMIN/health" | grep -q '"ok":true'; do
    waited=$((waited + 5))
    if [ "$waited" -ge "$WAIT_SECONDS" ]; then echo "The API did not answer in time" >&2; exit 1; fi
    sleep 5
  done
fi

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
health=$("${CURL[@]}" "$ADMIN/health")
contains "$health" '"ok":true'; check "API health (database reachable)" $?
if [ -n "${EXPECT_VERSION:-}" ]; then
  contains "$health" "\"version\":\"$EXPECT_VERSION\""; check "the API is running build $EXPECT_VERSION" $?
fi
body=$("${CURL[@]}" "$ADMIN/users")
contains "$body" "Trestle Admin"; check "admin panel served from the API's origin (client-side route)" $?
h=$(headers "$ADMIN/")
contains "$h" "content-security-policy-report-only"; check "admin panel has its own CSP" $?
h=$(gql_full '{ me { id } }' null)
contains "$h" "cache-control: private, no-store"; check "API responses are not cacheable" $?
contains "$h" "default-src 'none'"; check "API has a deny-all CSP" $?
contains "$h" "^HTTP/[0-9.]* 401"; check "the API refuses a request that is not signed in" $?
[ "$(status "$ADMIN/api/projects")" = "404" ]; check "the old REST paths are gone" $?

if [ "$LEVEL" = "full" ]; then

echo "Admin sign-in with a cookie session"
jar=$(mktemp)
login=$(gql_full "$LOGIN" "$LOGIN_VARS" -c "$jar" -H 'x-auth-mode: cookie')
contains "$login" "set-cookie: __Host-trestle_session="; check "session cookie has the __Host- prefix" $?
contains "$login" "set-cookie:.*httponly"; check "cookie is HttpOnly" $?
contains "$login" "set-cookie:.*secure"; check "cookie is Secure" $?
contains "$login" '"token":null'; check "the token is not given to the page" $?
[ "$(gql_status '{ me { id } }' null -b "$jar")" = "200" ]; check "the cookie authenticates later requests" $?
RENAME='mutation Rename($input: UpdateProfileInput!) { updateProfile(input: $input) { id } }'
write() { gql_status "$RENAME" "{\"input\":{\"name\":\"Jordan Kim\",\"email\":\"$EMAIL\"}}" -b "$jar" -H "Origin: $1"; }
[ "$(write "$ADMIN")" = "200" ]; check "a write from the panel's own origin is accepted" $?
[ "$(write "https://evil.example")" = "403" ]; check "a request from another origin is refused" $?
contains "$(gql '{ me { id } }' null -b "$jar" -H "Origin: https://evil.example")" "cross-site"; check "and says why" $?
contains "$(gql 'mutation { logout }' null -b "$jar" -H "Origin: $ADMIN")" '"logout":true'; check "sign-out succeeds" $?
[ "$(gql_status '{ me { id } }' null -b "$jar")" = "401" ]; check "the session is revoked on the server" $?
rm -f "$jar"

echo "Product app, signed in"
token=$(gql "$LOGIN" "$LOGIN_VARS" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$token" ]; check "token sign-in (what the product app's server uses)" $?
page=$("${CURL[@]}" -H "Cookie: __Host-trestle_session=$token" "$APP/en/dashboard")
contains "$page" "Jordan"; check "dashboard renders the signed-in user's data from the API" $?

echo "Data round trip"
auth=(-H "Authorization: Bearer $token")
created=$(gql 'mutation { createProject(input: { name: "Smoke test project" }) { id } }' null "${auth[@]}")
id=$(printf '%s' "$created" | sed -n 's/.*"createProject":{"id":"\([^"]*\)".*/\1/p')
[ -n "$id" ]; check "create a project" $?
contains "$(gql 'query Project($id: ID!) { project(id: $id) { id } }' "{\"id\":\"$id\"}" "${auth[@]}")" "\"id\":\"$id\""; check "read it back" $?
contains "$(gql 'mutation Delete($id: ID!) { deleteProject(id: $id) }' "{\"id\":\"$id\"}" "${auth[@]}")" '"deleteProject":true'; check "delete it" $?
gql 'mutation { logout }' null "${auth[@]}" >/dev/null

fi

echo
if [ "$failures" -eq 0 ]; then echo "Smoke test passed."; else echo "Smoke test FAILED: $failures check(s)."; fi
exit "$failures"
