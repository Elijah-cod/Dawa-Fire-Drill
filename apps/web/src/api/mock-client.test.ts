import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockClient } from "./mock-client";
import fixture from "../fixtures/kisumu.json";

afterEach(() => vi.unstubAllEnvs());

describe("OpenAPI-typed synthetic mock", () => {
  it.each(["planner", "pharmacist", "facility", "admin"] as const)(
    "provides a fixture identity for %s",
    (role) => {
      expect(createMockClient(role).session.role).toBe(role);
    },
  );
  it("limits the national planning overview to the planner and admin fixtures", async () => {
    expect((await createMockClient("planner").overview()).items).toHaveLength(
      47,
    );
    expect((await createMockClient("admin").overview()).items).toHaveLength(47);
    await expect(createMockClient("facility").overview()).rejects.toThrow(
      "Forbidden",
    );
    await expect(createMockClient("pharmacist").overview()).rejects.toThrow(
      "Forbidden",
    );
  });
  it("contains the pinned synthetic shock case", async () => {
    const run = await createMockClient("planner").kisumuRun();
    expect(run.synthetic).toBe(true);
    expect(run.county_code).toBe("042");
    expect(run.result?.shock_caused_stockouts).toBeDefined();
    await expect(createMockClient("facility").kisumuRun()).rejects.toThrow(
      "Forbidden",
    );
  });
  it("limits a facility fixture to its own synthetic facility", async () => {
    const facility = createMockClient("facility");
    expect((await facility.facility("SYN-KE-042-F001")).facility.id).toBe(
      "SYN-KE-042-F001",
    );
    await expect(facility.facility("SYN-KE-042-F002")).rejects.toThrow(
      "Forbidden",
    );
    await expect(facility.pilot()).rejects.toThrow("Forbidden");
    expect((await createMockClient("pharmacist").pilot()).county_code).toBe(
      "042",
    );
  });
  it("returns distinct backend-generated baseline and shock fixtures", async () => {
    const mock = createMockClient("planner");
    const base = {
      name: "Synthetic",
      shock_type: "logistics_reduction" as const,
      seed: 42,
      horizon_days: 90,
    };
    const baseline = await mock.submitRun({ ...base, magnitude: 0 });
    const shock = await mock.submitRun({ ...base, magnitude: 40 });
    expect(baseline.result?.shock_caused_stockouts).toEqual([]);
    expect(
      (shock.result?.shock_caused_stockouts as unknown[]).length,
    ).toBeGreaterThan(0);
    await expect(mock.submitRun({ ...base, magnitude: 20 })).rejects.toThrow(
      "fixture unavailable",
    );
  });
  it("refuses mock data in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => createMockClient("planner")).toThrow("disabled in production");
  });
});

it("returns only the recorded optimizer fixture for the exact synthetic demo inputs", async () => {
  const mock = createMockClient("planner");
  const route = fixture.pilot.demo_cases.near_expiry_transfer;
  const request = {
    synthetic_attested: true as const,
    budget: 100,
    minimum_benefit: 1,
    candidates: [
      {
        id: "transfer",
        kind: "redistribution" as const,
        cost: 10,
        facility_id: route.facility_id,
        donor_facility_id: route.donor_facility_id,
        commodity_id: route.commodity_id,
        quantity: route.quantity,
        available_units: route.available_units,
        dispatch_day: route.dispatch_day,
        arrival_day: route.arrival_day,
        expiry_day: route.expiry_day,
        minimum_shelf_days: route.minimum_shelf_days,
        distance_km: route.distance_km,
        max_distance_km: route.maximum_distance_km,
      },
      {
        id: "emergency",
        kind: "emergency_procurement" as const,
        cost: 50,
        facility_id: route.facility_id,
        commodity_id: route.commodity_id,
        arrival_day: route.arrival_day,
        quantity: route.quantity,
      },
    ],
  };
  const response = await mock.rank(
    "00000000-0000-4000-8000-000000000042",
    request,
  );
  expect(response.selected_ids).toEqual(["transfer"]);
  await expect(
    mock.rank("00000000-0000-4000-8000-000000000042", {
      ...request,
      budget: 1,
    }),
  ).rejects.toThrow();
  await expect(
    createMockClient("facility").rank(
      "00000000-0000-4000-8000-000000000042",
      request,
    ),
  ).rejects.toThrow();
});

it("serves the backend-generated funding trace only for the planted flow and planners", async () => {
  const trace = await createMockClient("planner").fundingTrace(
    "SYN-042-FLOW-01",
    "2025-04-01",
  );
  expect(trace.synthetic).toBe(true);
  expect(trace.bottlenecks[0]).toEqual({
    stage: "approved_not_released",
    amount: 100000,
    age_days: 90,
  });
  await expect(
    createMockClient("planner").fundingTrace("SYN-042-FLOW-01", "2025-05-01"),
  ).rejects.toThrow();
  await expect(
    createMockClient("facility").fundingTrace("SYN-042-FLOW-01", "2025-04-01"),
  ).rejects.toThrow("Forbidden");
});
