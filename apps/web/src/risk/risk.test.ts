import { describe, expect, it } from "vitest";
import { classifyDays, facilityRisk, riskLegend, risksForRun } from "./risk";

describe("illustrative facility stockout risk", () => {
  it.each([
    [0, "critical"],
    [45, "critical"],
    [46, "watch"],
    [52, "watch"],
    [53, "stable"],
    [null, "stable"],
    [undefined, "unknown"],
  ] as const)("classifies %s days as %s", (days, status) =>
    expect(classifyDays(days)).toBe(status),
  );
  it("uses the worst commodity and reports its identifier and days", () => {
    expect(
      facilityRisk([
        { commodityId: "C1", days: 53 },
        { commodityId: "C2", days: 45 },
      ]),
    ).toEqual({ status: "critical", drivers: ["C2"], days: 45 });
    expect(
      facilityRisk([
        { commodityId: "C1", days: 53 },
        { commodityId: "C2", days: undefined },
      ]).status,
    ).toBe("unknown");
    expect(facilityRisk([]).status).toBe("unknown");
  });
  it("changes when the selected scenario changes", () => {
    expect(facilityRisk([{ commodityId: "C1", days: null }]).status).toBe(
      "stable",
    );
    expect(facilityRisk([{ commodityId: "C1", days: 46 }]).status).toBe(
      "watch",
    );
  });
  it("derives each facility's worst tracer from the selected run and available inputs", () => {
    const panel = {
      facilities: [{ id: "F1" }],
      commodities: [{ id: "C1" }, { id: "C2" }],
      consumption: [
        { facility_id: "F1", commodity_id: "C1", month_index: 23 },
        { facility_id: "F1", commodity_id: "C2", month_index: 23 },
      ],
      stock: [
        { facility_id: "F1", commodity_id: "C1", opening_stock: 10 },
        { facility_id: "F1", commodity_id: "C2", opening_stock: 10 },
      ],
    };
    expect(risksForRun(panel, null).F1.status).toBe("unknown");
    expect(
      risksForRun(panel, { horizon_days: 90, stockouts: [] }).F1.status,
    ).toBe("stable");
    expect(
      risksForRun(panel, {
        horizon_days: 90,
        stockouts: [{ facility_id: "F1", commodity_id: "C2", day: 46 }],
      }).F1,
    ).toEqual({ status: "watch", drivers: ["C2"], days: 46 });
    expect(
      risksForRun(
        { ...panel, stock: panel.stock.slice(0, 1) },
        { horizon_days: 90, stockouts: [] },
      ).F1.status,
    ).toBe("unknown");
    const empty = {
      ...panel,
      stock: [{ ...panel.stock[0], opening_stock: 0 }, panel.stock[1]],
    };
    expect(risksForRun(empty, { horizon_days: 90, stockouts: [] }).F1).toEqual({
      status: "critical",
      drivers: ["C1"],
      days: 0,
    });
  });
  it("builds legend text from the configured cutoffs", () => {
    expect(riskLegend()).toContain(
      "Critical: already stocked out or within 45 days",
    );
    expect(riskLegend()).toContain("Watch: 46–52 days");
    expect(riskLegend()).toContain("Stable: no stockout within 52 days");
    expect(riskLegend("sw")).toContain("Angalizo: siku 46–52");
    expect(riskLegend()).toContain(
      "Labels are relative to the 90-day simulation horizon. The cutoffs were tuned to make this synthetic scenario readable; they are not a standard.",
    );
    expect(riskLegend()).toContain(
      "Illustrative thresholds, not clinical or operational standards.",
    );
  });
});
