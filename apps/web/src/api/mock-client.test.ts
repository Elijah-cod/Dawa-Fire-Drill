import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockClient } from "./mock-client";
import { fixCandidates, plannedFixes } from "./candidates";
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

it("returns only the recorded optimizer fixtures for the exact synthetic demo inputs", async () => {
  const mock = createMockClient("planner");
  const candidates = fixCandidates(
    plannedFixes(
      fixture.run.shock_caused_stockouts,
      fixture.pilot.demo_cases.transfer_routes,
    ),
  );
  expect(candidates).toHaveLength(8);
  const request = {
    synthetic_attested: true as const,
    budget: 30,
    candidates,
  };
  const runId = "00000000-0000-4000-8000-000000000042";
  const partial = await mock.rank(runId, request);
  expect(partial.selected_ids).toEqual([
    "transfer-1",
    "transfer-2",
    "transfer-3",
  ]);
  expect(partial.excluded_reasons["transfer-4"]).toBe(
    "remaining_budget_exceeded",
  );
  expect(
    (await mock.rank(runId, { ...request, budget: 100 })).selected_ids,
  ).toHaveLength(4);
  await expect(mock.rank(runId, { ...request, budget: 31 })).rejects.toThrow();
  await expect(
    mock.rank(runId, { ...request, minimum_benefit: 1 }),
  ).rejects.toThrow();
  await expect(
    mock.rank(runId, { ...request, candidates: candidates.slice(1) }),
  ).rejects.toThrow();
  await expect(
    createMockClient("facility").rank(runId, request),
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
