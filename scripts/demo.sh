#!/usr/bin/env bash
# All inputs are synthetic; every result is illustrative and unvalidated.
set -euo pipefail
: "${API_TOKEN:?Set API_TOKEN to an authenticated demo administrator JWT}"
if [[ ! "$API_TOKEN" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
  printf '%s\n' 'API_TOKEN must be a JWT.' >&2; exit 1
fi
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
base="${API_BASE:-http://localhost:8000}"
seed="${SYNTHETIC_SEED:-42}"
umask 077
scratch="$(mktemp -d "${TMPDIR:-/tmp}/dawa-demo.XXXXXXXX")"
trap 'rm -rf "$scratch"' EXIT
printf 'header = "Authorization: Bearer %s"\n' "$API_TOKEN" > "$scratch/auth"
request_id="$(python3 -c 'import uuid; print(uuid.uuid4())')"
call() { curl --silent --show-error --fail-with-body --config "$scratch/auth" "$@"; }
printf '%s\n' 'Synthetic data; all model outputs are illustrative and unvalidated.'
docker compose -f "$root/infra/compose.yaml" exec -T api python -m dawa_api.ingestion.seed_counties --seed "$seed"
printf '%s\n' 'National planning overview:'
call -H 'X-Demo-Role: national' "$base/v1/counties/overview?seed=$seed"; printf '\n'
body="$(python3 -c 'import json,sys; print(json.dumps({"name":"Synthetic donor shock","shock_type":"logistics_reduction","magnitude":40,"seed":int(sys.argv[1]),"horizon_days":90}))' "$seed")"
submission="$(call -H 'X-Demo-Role: planner' -H 'Content-Type: application/json' -H "Idempotency-Key: demo-$request_id" -d "$body" "$base/v1/counties/042/runs")"
run_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<< "$submission")"
for ((attempt=0; attempt<60; attempt++)); do
  run="$(call -H 'X-Demo-Role: planner' "$base/v1/counties/042/runs/$run_id")"
  status="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<< "$run")"
  [[ "$status" == succeeded ]] && break
  if [[ "$status" == failed ]]; then printf '%s\n' 'Synthetic run failed.' >&2; exit 1; fi
  sleep 1
done
[[ "$status" == succeeded ]] || { printf '%s\n' 'Synthetic run timed out.' >&2; exit 1; }
printf '%s\n' 'First-stockout order:'
python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["result"]["stockouts"]))' <<< "$run"
printf '%s\n' 'Monthly baseline forecast:'
call -H 'X-Demo-Role: planner' "$base/v1/counties/042/runs/$run_id/forecast?facility_id=SYN-KE-042-F001&commodity_id=SYN-C01"; printf '\n'
printf '%s\n' 'Stalled cash release:'
call -H 'X-Demo-Role: planner' "$base/v1/counties/042/funding/SYN-042-FLOW-01/trace?seed=$seed&as_of=2025-04-01"; printf '\n'
mitigation="$(python3 -c 'import json,sys; t=json.load(sys.stdin)["result"]["demo_cases"]["near_expiry_transfer"]; x={"id":"transfer","kind":"redistribution","cost":10,"facility_id":t["facility_id"],"donor_facility_id":t["donor_facility_id"],"commodity_id":t["commodity_id"],"quantity":t["quantity"],"available_units":t["available_units"],"dispatch_day":t["dispatch_day"],"arrival_day":t["arrival_day"],"expiry_day":t["expiry_day"],"minimum_shelf_days":t["minimum_shelf_days"],"distance_km":t["distance_km"],"max_distance_km":t["maximum_distance_km"]}; y={"id":"emergency","kind":"emergency_procurement","cost":50,"facility_id":t["facility_id"],"commodity_id":t["commodity_id"],"quantity":t["quantity"],"arrival_day":t["arrival_day"]}; print(json.dumps({"synthetic_attested":True,"budget":100,"minimum_benefit":1,"candidates":[x,y]}))' <<< "$run")"
printf '%s\n' 'Ranked mitigations and optimizer explanation:'
call -H 'X-Demo-Role: planner' -H 'Content-Type: application/json' -d "$mitigation" "$base/v1/counties/042/runs/$run_id/mitigations"; printf '\n'
python3 -c 'import struct,zlib,sys; chunk=lambda k,v:struct.pack("!I",len(v))+k+v+struct.pack("!I",zlib.crc32(k+v)); open(sys.argv[1],"wb").write(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack("!IIBBBBB",4,4,8,2,0,0,0))+chunk(b"IDAT",zlib.compress((b"\0"+b"\xff"*12)*4))+chunk(b"IEND",b""))' "$scratch/synthetic.png"
capture_base="$base/v1/counties/042/facilities/SYN-KE-042-F001/captures"
printf '%s\n' 'Synthetic bin-card capture:'
capture="$(call -H 'X-Demo-Role: facility' -H "Idempotency-Key: capture-$request_id" -F 'synthetic_attested=true' -F "file=@$scratch/synthetic.png;type=image/png" "$capture_base?seed=$seed")"
printf '%s\n' "$capture"
capture_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<< "$capture")"
printf '%s\n' 'Human-reviewed synthetic stock:'
call -H 'X-Demo-Role: facility' -H 'Content-Type: application/json' -d '{"reviewed":true,"fields":{"commodity_name":"Synthetic tracer","opening_balance":5,"closing_balance":3,"record_date":"2026-01-01"}}' "$capture_base/$capture_id/confirm"; printf '\n'
