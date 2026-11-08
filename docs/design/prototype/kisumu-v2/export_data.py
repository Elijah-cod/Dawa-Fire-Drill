"""Export the Kisumu v3 preview data from backend code (generator v5, seed 42).

Run from apps/api: `uv run --frozen python ../../docs/design/prototype/kisumu-v2/export_data.py`.
Writes data.js next to this file. Only backend outputs are exported: run stockouts,
pre-shock and no-shock stockouts, funding trace, and OR-Tools rankings for every
budget step. Display names are invented (see NAME_* below), not real facilities.
"""

import json
from datetime import date
from pathlib import Path

from dawa_api.explain.service import explain_selection
from dawa_api.finance_flow.application import trace_kisumu_case
from dawa_api.ingestion.kisumu import generate_kisumu_panel
from dawa_api.optimization.kisumu import rank_kisumu
from dawa_api.optimization.modeled_schemas import ModeledRequest
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.kisumu import simulate_kisumu

SEED, VERSION, HORIZON = 42, 5, 90
MAGNITUDES = (0, 20, 40, 100)
BUDGETS = range(0, 101, 5)
TRANSFER_COST, EMERGENCY_COST = 10, 50  # illustrative assumptions used by the app

# Invented display names: tree + landscape word, assigned in facility order. No real
# facility, village or person names; not checked against any register.
NAME_TREES = ["Acacia", "Mvule", "Cedar", "Jacaranda", "Neem", "Fig", "Tamarind", "Croton"]
NAME_FEATURES = ["Ridge", "Spring", "Grove", "Crossing", "Gate"]
LEVEL_SUFFIX = {2: "Dispensary", 3: "Health Centre", 4: "Sub-County Hospital", 5: "County Referral Hospital"}

pilot = generate_kisumu_panel(seed=SEED, version=VERSION)
subs = {s["id"]: s["name"] for s in pilot["subcounties"]}
facilities = []
for i, f in enumerate(pilot["facilities"]):
    stem = f"{NAME_TREES[i % len(NAME_TREES)]} {NAME_FEATURES[i // len(NAME_TREES)]}"
    facilities.append({
        "id": f["id"], "short": f["id"].split("-")[-1], "name": f"{stem} {LEVEL_SUFFIX[f['level']]}",
        "level": f["level"], "sub": subs[f["subcounty_id"]], "lat": f["latitude"], "lon": f["longitude"],
    })
assert len({f["name"] for f in facilities}) == len(facilities)

def scenario(m):
    return ScenarioCreate.model_validate({"name": "Synthetic donor shock", "shock_type": "logistics_reduction",
                                         "magnitude": m, "seed": SEED, "horizon_days": HORIZON})

routes = pilot["demo_cases"]["transfer_routes"]
runs = {}
for m in MAGNITUDES:
    r = simulate_kisumu(scenario(m), pilot, horizon_days=HORIZON)
    events = r["shock_caused_stockouts"]
    fixes = []
    for route in routes:
        ev = next((e for e in events if (e["facility_id"], e["commodity_id"]) == (route["facility_id"], route["commodity_id"])), None)
        if ev and route["arrival_day"] <= ev["day"]:
            fixes.append((ev, route))
    fixes.sort(key=lambda x: x[0]["day"])
    candidates = []
    for k, (_, route) in enumerate(fixes, 1):
        common = {"facility_id": route["facility_id"], "commodity_id": route["commodity_id"],
                  "quantity": route["quantity"], "arrival_day": route["arrival_day"]}
        candidates += [
            {"id": f"transfer-{k}", "kind": "redistribution", "cost": TRANSFER_COST, **common,
             "donor_facility_id": route["donor_facility_id"], "available_units": route["available_units"],
             "dispatch_day": route["dispatch_day"], "expiry_day": route["expiry_day"],
             "minimum_shelf_days": route["minimum_shelf_days"], "distance_km": route["distance_km"],
             "max_distance_km": route["maximum_distance_km"]},
            {"id": f"emergency-{k}", "kind": "emergency_procurement", "cost": EMERGENCY_COST, **common},
        ]
    rankings = {}
    if candidates:
        for b in BUDGETS:
            res, effects = rank_kisumu(scenario(m), pilot, r, horizon_days=HORIZON,
                                       request=ModeledRequest.model_validate({"synthetic_attested": True, "budget": b, "candidates": candidates}))
            rankings[b] = {"selected": list(res.selected_ids), "excluded": res.excluded_reasons, "total_cost": res.total_cost,
                           "explanation": explain_selection(res, budget=b).text,
                           "effects": {e.id: {"baseline": e.baseline_stockout_day, "counterfactual": e.counterfactual_stockout_day, "deferred": e.deferred_days} for e in effects}}
    runs[m] = {
        "stockouts": [[e["facility_id"], e["commodity_id"], e["day"]] for e in r["stockouts"]],
        # Event-level lists exactly as the backend classifies them.
        "shockEvents": [[e["facility_id"], e["commodity_id"], e["day"]] for e in r["shock_caused_stockouts"]],
        "preEvents": [[e["facility_id"], e["commodity_id"], e["day"]] for e in r["pre_shock_stockouts"]],
        "noShockEvents": [[e["facility_id"], e["commodity_id"], e["day"]] for e in r["baseline_stockouts"]],
        "pre": sorted({e["facility_id"] for e in r["pre_shock_stockouts"]}),
        "noShock": sorted({e["facility_id"] for e in r["baseline_stockouts"]}),
        "shockCaused": len(events),
        "alreadyShortEvents": len(r["pre_shock_stockouts"]) + len(r["baseline_stockouts"]),
        "candidates": [{k: c[k] for k in ("id", "kind", "cost", "facility_id", "commodity_id") } | ({"donor": c["donor_facility_id"], "km": c["distance_km"]} if c["kind"] == "redistribution" else {}) for c in candidates],
        "rankings": rankings,
    }
flow = pilot["demo_cases"]["stalled_release"]
funding = trace_kisumu_case(pilot, flow_id=flow["id"], as_of=date.fromisoformat(flow["as_of"])).model_dump(mode="json")
# Funding stage amounts are the inputs the backend's trace_kisumu_case uses (procured and
# delivered are 0 there for this planted flow).
stages = [["Approved", flow["approved"]], ["Released", flow["released"]], ["Procured", 0], ["Delivered", 0]]
data = {"seed": SEED, "generatorVersion": VERSION, "horizon": HORIZON, "facilities": facilities, "runs": runs,
        "flow": flow, "funding": funding, "fundingStages": stages,
        "commodities": [{"id": c["id"], "name": c["name"], "category": c["category"]} for c in pilot["commodities"]],
        "routes": [{"facility_id": r["facility_id"], "commodity_id": r["commodity_id"], "arrival_day": r["arrival_day"],
                    "donor": r["donor_facility_id"]} for r in routes]}
out = Path(__file__).with_name("data.js")
out.write_text("// Exported by export_data.py from backend code: generator v5, seed 42. Do not edit by hand.\n"
               "window.KISUMU_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
print(out, out.stat().st_size // 1024, "KB")
for m in MAGNITUDES:
    rk = runs[m]["rankings"]
    print(m, "stockouts", len(runs[m]["stockouts"]), "shock-caused", runs[m]["shockCaused"], "pre", runs[m]["pre"], "noShock", runs[m]["noShock"],
          "fixes", len(runs[m]["candidates"]) // 2, {b: (len(rk[b]["selected"]), rk[b]["total_cost"]) for b in (5, 30, 100)} if rk else "no candidates")
