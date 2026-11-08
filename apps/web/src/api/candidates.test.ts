import { expect, it } from "vitest";
import { fixCandidates, plannedFixes } from "./candidates";

const route = (
  facility_id: string,
  commodity_id: string,
  arrival_day: number,
) => ({
  synthetic: true,
  donor_facility_id: "D",
  facility_id,
  commodity_id,
  quantity: 100,
  available_units: 600,
  dispatch_day: arrival_day - 1,
  arrival_day,
  expiry_day: arrival_day + 44,
  minimum_shelf_days: 7,
  distance_km: 11,
  maximum_distance_km: 30,
});
const events = [
  { facility_id: "F031", commodity_id: "C04", day: 41 },
  { facility_id: "F019", commodity_id: "C03", day: 43 },
  { facility_id: "F004", commodity_id: "C04", day: 44 },
];

it("pairs each planted route with its shock event, earliest first, and skips late or unmatched routes", () => {
  const fixes = plannedFixes(events, [
    route("F019", "C03", 41),
    route("F031", "C04", 39),
    route("F004", "C04", 50),
    route("F999", "C01", 2),
    { ...route("F004", "C04", 42), synthetic: false },
  ]);
  expect(fixes.map((fix) => [fix.index, fix.event.facility_id])).toEqual([
    [1, "F031"],
    [2, "F019"],
  ]);
  const candidates = fixCandidates(fixes);
  expect(candidates.map((item) => [item.id, item.kind, item.cost])).toEqual([
    ["transfer-1", "redistribution", 10],
    ["emergency-1", "emergency_procurement", 50],
    ["transfer-2", "redistribution", 10],
    ["emergency-2", "emergency_procurement", 50],
  ]);
  expect(candidates[1]).toMatchObject({ arrival_day: 39, quantity: 100 });
});
