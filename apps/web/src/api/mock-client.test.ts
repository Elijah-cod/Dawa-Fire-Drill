import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockClient } from "./mock-client";

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
  it("refuses mock data in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => createMockClient("planner")).toThrow("disabled in production");
  });
});
