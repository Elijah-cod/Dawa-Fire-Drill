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
 * The funding part is the backend trace of the planted stalled-release flow
 * at its own as_of date.
 *
 * Always regenerate from backend county generator version 4 with seed 42;
 * never hand-edit. Usage, from apps/web (requires uv):
 *   node scripts/build-fixtures.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SEED = 42;
const GENERATOR_VERSION = 4;
const SIMULATION_VERSION = 2;
const HORIZON_DAYS = 90;
const SHOCK_MAGNITUDE = 40;
const KEEP_MONTHS = 3;

const api = resolve(import.meta.dirname, "../../api");
const output = resolve(import.meta.dirname, "../src/fixtures/kisumu.json");
const python = `
import json
from datetime import date
from dawa_api.finance_flow.application import trace_kisumu_case
from dawa_api.ingestion.county_planning import generate_county_planning
from dawa_api.ingestion.kisumu import generate_kisumu_panel
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

print(json.dumps({
    "planning": generate_county_planning(seed=${SEED}),
    "pilot": pilot,
    "baseline": run(0),
    "run": run(${SHOCK_MAGNITUDE}),
    "funding": funding,
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
const fixture = JSON.parse(result.stdout);
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
