#!/usr/bin/env bash
# Undo scripts/demo-up.sh: stop its web server and restore the api container
# to its default settings (role switching off, no signing material).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
compose="${DAWA_COMPOSE_FILE:-$root/infra/compose.yaml}"
state="${DAWA_DEMO_STATE_DIR:-${TMPDIR:-/tmp}/dawa-demo-$(id -u)}"

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ "${APP_ENV:-local}" == local ]] || fail "Refusing: APP_ENV must be local (got ${APP_ENV})."
[[ -f "$compose" ]] || fail "Refusing: compose file not found."
compose_real="$(cd "$(dirname "$compose")" && pwd -P)/$(basename "$compose")"
[[ "$compose_real" == "$root/infra/compose.yaml" ]] ||
  fail "Refusing: only the local infra/compose.yaml may be used."

if [[ -f "$state/web.pid" ]]; then
  pid="$(cat "$state/web.pid")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
    printf '%s\n' 'Stopped the demo web server.'
  fi
else
  printf '%s\n' 'No demo web server recorded.'
fi
rm -rf "$state"

export APP_ENV=local DEMO_ROLE_SWITCHER=false SUPABASE_URL="" SUPABASE_JWT_SECRET="" RATE_LIMIT_PER_MINUTE=60
docker compose -f "$compose" up -d --no-deps --no-build api >/dev/null 2>&1 ||
  fail "Could not restore the api container."
for ((attempt = 0; attempt < 60; attempt++)); do
  if curl --silent --fail "http://localhost:8000/ready" >/dev/null 2>&1; then
    printf '%s\n' 'API restored to default settings (demo role switching off).'
    exit 0
  fi
  sleep 1
done
fail "API did not become ready after restore."
