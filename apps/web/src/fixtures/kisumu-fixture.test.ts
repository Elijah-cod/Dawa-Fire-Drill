import { statSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import fixture from "./kisumu.json";

const path = resolve(import.meta.dirname, "kisumu.json");

it("keeps the generated development fixture under 0.5 MB", () => {
  expect(statSync(path).size).toBeLessThan(500_000);
});

it("contains only synthetic seed-42 data with the last three consumption months", () => {
  for (const part of [
    fixture.planning,
    fixture.pilot,
    fixture.baseline,
    fixture.run,
    fixture.funding,
  ])
    expect(part.synthetic).toBe(true);
  expect(fixture.pilot.seed).toBe(42);
  expect(
    [...new Set(fixture.pilot.consumption.map((row) => row.month_index))].sort(
      (a, b) => a - b,
    ),
  ).toEqual([21, 22, 23]);
  expect(fixture.pilot.consumption).toHaveLength(
    fixture.pilot.facilities.length * fixture.pilot.commodities.length * 3,
  );
});

it("keeps the version-4 transfer aimed at the first shock-caused stockout", () => {
  const transfer = fixture.pilot.demo_cases.near_expiry_transfer;
  const first = fixture.run.shock_caused_stockouts[0];
  expect([transfer.facility_id, transfer.commodity_id]).toEqual([
    first.facility_id,
    first.commodity_id,
  ]);
});
