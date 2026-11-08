/* global console, process */
/**
 * Regenerates src/fixtures/kisumu.json for the development mock client.
 *
 * Synthetic data only: invented facilities, stock and consumption, calibrated
 * to public aggregates where documented. Runs are illustrative and unvalidated.
 *
 * The fixture is trimmed: pilot.consumption keeps only the last 3 months
 * (month_index 21–23). The risk view reads month 23 only, and the stored
 * baseline and 40% runs are computed by the backend from the full panel
 * before trimming, so the UI is unchanged. Do not use this fixture as
 * simulation input.
 *
 * risk_runs keeps only the stockout lists of the backend runs at 0, 20, 40 and 100% for
 * map risk tests.
 *
 * The funding part is the backend trace of the planted stalled-release flow
 * at its own as_of date.
 *
 * ranked-fixes.json holds the backend rankings (OR-Tools via rank_kisumu and the
 * deterministic explanation) of the candidates the web app builds for the 40%
 * run, keyed by ceiling: 30, 100 and 5 KES.
 *
 * Always regenerate from backend county generator version 5 with seed 42;
 * never hand-edit. Usage, from apps/web (requires uv):
 *   node scripts/build-fixtures.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SEED = 42;
const GENERATOR_VERSION = 5;
const SIMULATION_VERSION = 2;
const HORIZON_DAYS = 90;
const SHOCK_MAGNITUDE = 40;
const KEEP_MONTHS = 3;
// Ceilings with recorded rankings for the mock client (KES, illustrative).
const BUDGETS = [30, 100, 5];
// The mock client's fixed run ID for the 40% shock.
const RUN_ID = "00000000-0000-4000-8000-000000000042";

const api = resolve(import.meta.dirname, "../../api");
const output = resolve(import.meta.dirname, "../src/fixtures/kisumu.json");
const rankedOutput = resolve(
  import.meta.dirname,
  "../src/fixtures/ranked-fixes.json",
);
const python = `
import json
from datetime import date
from dawa_api.finance_flow.application import trace_kisumu_case
from dawa_api.ingestion.county_planning import generate_county_planning
from dawa_api.explain.service import explain_selection
from dawa_api.ingestion.kisumu import generate_kisumu_panel
from dawa_api.optimization.kisumu import rank_kisumu
from dawa_api.optimization.modeled_schemas import ModeledRequest, ModeledResponse
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.kisumu import simulate_kisumu

pilot = generate_kisumu_panel(seed=${SEED}, version=${GENERATOR_VERSION})

def run(magnitude):
    scenario = ScenarioCreate.model_validate({
        "name": "Synthetic donor shock",
        "shock_type": "logistics_reduction",
        "magnitude": magnitude,
        "seed": ${SEED},
        "horizon_days": ${HORIZON_DAYS},
    })
    return simulate_kisumu(
        scenario, pilot, horizon_days=${HORIZON_DAYS},
        simulation_version=${SIMULATION_VERSION},
    )

flow = pilot["demo_cases"]["stalled_release"]
funding = trace_kisumu_case(
    pilot, flow_id=flow["id"], as_of=date.fromisoformat(flow["as_of"])
).model_dump(mode="json")

RUN_ID = "${RUN_ID}"
shock_run = run(${SHOCK_MAGNITUDE})
events = shock_run["shock_caused_stockouts"]
fixes = []
for route in pilot["demo_cases"]["transfer_routes"]:
    event = next(
        (e for e in events
         if (e["facility_id"], e["commodity_id"]) == (route["facility_id"], route["commodity_id"])),
        None,
    )
    if route.get("synthetic") is True and event and route["arrival_day"] <= event["day"]:
        fixes.append((event, route))
fixes.sort(key=lambda item: item[0]["day"])
candidates = []
for index, (_, route) in enumerate(fixes, 1):
    candidates += [
        {
            "id": f"transfer-{index}", "kind": "redistribution", "cost": 10,
            "facility_id": route["facility_id"],
            "donor_facility_id": route["donor_facility_id"],
            "commodity_id": route["commodity_id"],
            "quantity": route["quantity"],
            "available_units": route["available_units"],
            "dispatch_day": route["dispatch_day"],
            "arrival_day": route["arrival_day"],
            "expiry_day": route["expiry_day"],
            "minimum_shelf_days": route["minimum_shelf_days"],
            "distance_km": route["distance_km"],
            "max_distance_km": route["maximum_distance_km"],
        },
        {
            "id": f"emergency-{index}", "kind": "emergency_procurement", "cost": 50,
            "facility_id": route["facility_id"],
            "commodity_id": route["commodity_id"],
            "quantity": route["quantity"],
            "arrival_day": route["arrival_day"],
        },
    ]
scenario = ScenarioCreate.model_validate({
    "name": "Synthetic donor shock", "shock_type": "logistics_reduction",
    "magnitude": ${SHOCK_MAGNITUDE}, "seed": ${SEED}, "horizon_days": ${HORIZON_DAYS},
})
ranked = {}
for budget in ${JSON.stringify(BUDGETS)}:
    request = ModeledRequest.model_validate(
        {"synthetic_attested": True, "budget": budget, "candidates": candidates}
    )
    result, effects = rank_kisumu(
        scenario, pilot, shock_run, request=request, horizon_days=${HORIZON_DAYS}
    )
    ranked[str(budget)] = ModeledResponse(
        run_id=RUN_ID,
        explanation=explain_selection(result, budget=budget).text,
        selected_ids=result.selected_ids,
        selected_reasons={item: "included_in_optimal_set" for item in result.selected_ids},
        excluded_reasons=result.excluded_reasons,
        cut_line=len(result.selected_ids),
        total_cost=result.total_cost,
        remaining_budget=budget - result.total_cost,
        minimum_benefit=None,
        effects=effects,
    ).model_dump(mode="json")

print(json.dumps({
    "planning": generate_county_planning(seed=${SEED}),
    "pilot": pilot,
    "baseline": run(0),
    "run": shock_run,
    "funding": funding,
    "risk_runs": {
        str(m): {
            key: result[key]
            for key in ("horizon_days", "stockouts", "pre_shock_stockouts", "baseline_stockouts")
        }
        for m, result in ((m, run(m)) for m in (0, 20, 40, 100))
    },
    "ranked": ranked,
}))
`;

const result = spawnSync("uv", ["run", "--frozen", "python", "-"], {
  cwd: api,
  input: python,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(1);
}
const { ranked, ...fixture } = JSON.parse(result.stdout);
if (!Object.values(ranked).every((item) => item.synthetic === true))
  throw new Error("Ranking is not synthetic");
await writeFile(rankedOutput, `${JSON.stringify(ranked, null, 2)}\n`);
for (const part of ["planning", "pilot", "baseline", "run", "funding"])
  if (fixture[part]?.synthetic !== true)
    throw new Error(`Generated ${part} is not marked synthetic`);
const last = Math.max(
  ...fixture.pilot.consumption.map((row) => row.month_index),
);
fixture.pilot.consumption = fixture.pilot.consumption.filter(
  (row) => row.month_index > last - KEEP_MONTHS,
);
const text = `${JSON.stringify(fixture)}\n`;
await writeFile(output, text);
console.log(
  `Wrote ${output} (${(text.length / 1024).toFixed(0)} KiB, consumption months ${last - KEEP_MONTHS + 1}–${last})`,
);
