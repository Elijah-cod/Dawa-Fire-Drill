import { describe, expect, it } from "vitest";
import fixture from "../fixtures/kisumu.json";
import { commodityLabel, displayName, withDisplayNames } from "./names";
import { coverage, lateRoutes, runEvents } from "./view";

const routes = fixture.pilot.demo_cases.transfer_routes;
const run = (magnitude: "0" | "20" | "40" | "100") => ({
  synthetic: true,
  county_code: "042",
  ...fixture.risk_runs[magnitude],
});

describe("invented display names", () => {
  it("gives every facility a distinct name built from its level", () => {
    const named = withDisplayNames(fixture.pilot);
    const names = named.facilities.map((item) => item.name);
    expect(new Set(names).size).toBe(40);
    expect(names[0]).toBe("Acacia Ridge Dispensary");
    expect(
      named.facilities.find((item) => item.id === "SYN-KE-042-F031")?.name,
    ).toBe("Tamarind Crossing Sub-County Hospital");
    expect(displayName(0, 5)).toBe("Acacia Ridge County Referral Hospital");
  });
  it("labels commodities by backend category and tracer number", () => {
    expect(commodityLabel(fixture.pilot.commodities, "SYN-C04")).toBe(
      "Family planning tracer 04",
    );
    expect(commodityLabel(fixture.pilot.commodities, "SYN-C02", "sw")).toBe(
      "Kipimo cha malaria (kifuatiliaji 02)",
    );
    expect(commodityLabel(fixture.pilot.commodities, "SYN-X")).toBe("SYN-X");
  });
});

describe("run events", () => {
  it("keeps the backend's shock-caused list apart from already-short events", () => {
    const events = runEvents(run("40"))!;
    expect(events.all).toHaveLength(211);
    expect(events.shock).toHaveLength(209);
    expect(events.shock[0]).toMatchObject({
      facility_id: "SYN-KE-042-F031",
      commodity_id: "SYN-C04",
      day: 41,
    });
    expect(
      events.alreadyShort.map((item) => [item.facility_id, item.day]),
    ).toEqual([
      ["SYN-KE-042-F001", 1],
      ["SYN-KE-042-F003", 6],
    ]);
    expect(runEvents(run("0"))!.shock).toEqual([]);
  });
  it("rejects runs that are not synthetic Kisumu results", () => {
    expect(runEvents({ ...run("40"), synthetic: false })).toBeNull();
    expect(
      runEvents({ ...run("40"), shock_caused_stockouts: [{}] }),
    ).toBeNull();
    expect(runEvents(null)).toBeNull();
  });
});

describe("coverage", () => {
  it("says earliest only when the covered stockouts are the earliest", () => {
    expect(coverage(runEvents(run("40"))!.shock, routes)).toEqual({
      count: 4,
      total: 209,
      earliest: true,
      first: 41,
      last: 44,
    });
    expect(coverage(runEvents(run("20"))!.shock, routes)).toEqual({
      count: 4,
      total: 77,
      earliest: false,
      first: 47,
      last: 74,
    });
  });
  it("explains a shock where no transfer arrives in time", () => {
    const shock = runEvents(run("100"))!.shock;
    expect(coverage(shock, routes)).toBeNull();
    expect(lateRoutes(shock, routes)).toEqual({
      routes: 4,
      arrival: 39,
      day: 26,
    });
  });
});
