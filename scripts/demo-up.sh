#!/usr/bin/env bash
# Local-only synthetic demo session: disposable API signing material, a
# short-lived synthetic admin token, and the production web build on :3300.
# The secret and token live only in process environments; they are never
# printed or written to disk. Undo with scripts/demo-down.sh.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
compose="${DAWA_COMPOSE_FILE:-$root/infra/compose.yaml}"
state="${DAWA_DEMO_STATE_DIR:-${TMPDIR:-/tmp}/dawa-demo-$(id -u)}"
api="http://localhost:8000"
web_port=3300

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ "${APP_ENV:-local}" == local ]] || fail "Refusing: APP_ENV must be local (got ${APP_ENV})."
[[ -f "$compose" ]] || fail "Refusing: compose file not found."
compose_real="$(cd "$(dirname "$compose")" && pwd -P)/$(basename "$compose")"
[[ "$compose_real" == "$root/infra/compose.yaml" ]] ||
  fail "Refusing: only the local infra/compose.yaml may be used."
if lsof -nP -iTCP:"$web_port" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "Refusing: port $web_port is in use. Stop that server first (scripts/demo-down.sh if it is a demo)."
fi

umask 077
mkdir -p "$state"
chmod 700 "$state"
# The build log is temporary; web.log and web.pid stay private in $state until demo-down.
trap 'rm -f "$state/build.log"' EXIT

printf '%s\n' 'Synthetic data only; all outputs are illustrative and unvalidated.'
export APP_ENV=local DEMO_ROLE_SWITCHER=true SUPABASE_URL="https://synthetic-demo.invalid"
SUPABASE_JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
export SUPABASE_JWT_SECRET
printf '%s\n' 'Recreating the api container with disposable demo signing material…'
docker compose -f "$compose" up -d --no-deps --no-build api >/dev/null 2>&1 ||
  fail "Could not recreate the api container."
ready=false
for ((attempt = 0; attempt < 60; attempt++)); do
  if curl --silent --fail "$api/ready" >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || fail "API did not become ready; run scripts/demo-down.sh to restore it."

DEMO_API_TOKEN="$(cd "$root/apps/api" && uv run --frozen python -c '
import datetime, os
import jwt
now = datetime.datetime.now(datetime.UTC)
print(jwt.encode({
    "sub": "synthetic-demo-admin",
    "iat": now,
    "exp": now + datetime.timedelta(hours=4),
    "iss": os.environ["SUPABASE_URL"] + "/auth/v1",
    "aud": "authenticated",
    "app_metadata": {"role": "admin", "country_code": "KE"},
}, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256"))
' 2>/dev/null)" || fail "Could not create the synthetic demo token."
unset SUPABASE_JWT_SECRET
[[ "$DEMO_API_TOKEN" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]] ||
  fail "Synthetic demo token was malformed."

printf '%s\n' 'Building the web app (production mode)…'
if ! (cd "$root/apps/web" && npm run build >"$state/build.log" 2>&1); then
  tail -n 20 "$state/build.log" >&2
  fail "Web build failed. Run scripts/demo-down.sh to restore the api."
fi
(
  cd "$root/apps/web"
  export APP_ENV=local API_INTERNAL_URL="$api/v1" DEMO_API_TOKEN
  nohup npm run start -- -p "$web_port" >"$state/web.log" 2>&1 &
  printf '%s\n' "$!" >"$state/web.pid"
)
unset DEMO_API_TOKEN
started=false
for ((attempt = 0; attempt < 60; attempt++)); do
  if curl --silent --fail -o /dev/null "http://localhost:$web_port/kisumu" 2>/dev/null; then
    started=true; break
  fi
  sleep 1
done
[[ "$started" == true ]] || fail "Web server did not start; see $state/web.log."
printf '%s\n' "Demo ready: http://localhost:$web_port/kisumu (token valid for 4 hours)."
printf '%s\n' 'Stop with: bash scripts/demo-down.sh'
