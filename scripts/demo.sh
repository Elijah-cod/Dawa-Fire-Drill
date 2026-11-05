#!/usr/bin/env bash
# Synthetic data only. Results are illustrative and unvalidated.
set -euo pipefail

: "${API_TOKEN:?Set API_TOKEN to a planner or admin JWT}"
: "${DATABASE_URL:?Set DATABASE_URL for the synthetic seed command}"
if [[ ! "$API_TOKEN" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
  printf '%s\n' 'API_TOKEN must be a JWT.' >&2
  exit 1
fi
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_base="${API_BASE:-http://localhost:8000}"
seed_python="${SEED_PYTHON:-$root/apps/api/.venv/bin/python}"
seed="${SYNTHETIC_SEED:-42}"
umask 077
auth_file="$(mktemp "${TMPDIR:-/tmp}/dawa-demo.XXXXXXXX")"
trap 'rm -f "$auth_file"' EXIT
printf 'header = "Authorization: Bearer %s"\n' "$API_TOKEN" > "$auth_file"
request_id="$(python3 -c 'import uuid; print(uuid.uuid4())')"

printf '%s\n' 'Synthetic data; outputs are illustrative and unvalidated.'
(cd "$root/apps/api" && "$seed_python" -m dawa_api.ingestion.persist --country KE --seed "$seed")
scenario="$(curl --silent --show-error --fail-with-body --config "$auth_file" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: demo-scenario-$request_id" \
  -d '{"name":"Synthetic logistics shock","shock_type":"logistics_reduction","magnitude":40}' \
  "$api_base/v1/scenarios")"
scenario_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<< "$scenario")"
run_body="$(python3 -c 'import json,sys; print(json.dumps({"seed":int(sys.argv[1]),"horizon_days":90}))' "$seed")"
submission="$(curl --silent --show-error --fail-with-body --config "$auth_file" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: demo-run-$request_id" \
  -d "$run_body" "$api_base/v1/scenarios/$scenario_id/runs")"
run_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<< "$submission")"
for ((attempt=0; attempt<60; attempt++)); do
  run="$(curl --silent --show-error --fail-with-body --config "$auth_file" "$api_base/v1/runs/$run_id")"
  status="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<< "$run")"
  [[ "$status" == succeeded ]] && break
  if [[ "$status" == failed ]]; then printf '%s\n' 'Synthetic run failed.' >&2; exit 1; fi
  sleep 1
done
if [[ "$status" != succeeded ]]; then printf '%s\n' 'Synthetic run did not complete in time.' >&2; exit 1; fi
printf '%s\n' "$run"
mitigation="$(python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]["stockouts"]; print(json.dumps({"synthetic_attested": True, "budget": 100, "candidates": [{"id":"synthetic-emergency", "kind":"emergency_procurement", "facility_id":r[0]["facility_id"], "commodity_id":r[0]["commodity_id"], "cost":80, "benefit":1}]} if r else {}))' <<< "$run")"
if [[ "$mitigation" == '{}' ]]; then printf '%s\n' 'No synthetic stockouts to rank.'; exit 0; fi
printf '%s\n' 'Ranking uses illustrative assumed cost and benefit, not validated estimates.'
curl --silent --show-error --fail-with-body --config "$auth_file" \
  -H 'Content-Type: application/json' -d "$mitigation" "$api_base/v1/runs/$run_id/mitigations"
printf '\n'
