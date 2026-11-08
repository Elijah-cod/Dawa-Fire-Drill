import { describe, expect, it } from "vitest";
import fixture from "../fixtures/kisumu.json";
import { risksForRun, riskSummary, worstStatus } from "../risk/risk";
import { clusterPoints, CLUSTER_RADIUS_PX } from "./map-clusters";

type Run = {
  horizon_days: number;
  stockouts: { facility_id: string; commodity_id: string; day: number }[];
  pre_shock_stockouts: { facility_id: string }[];
  baseline_stockouts: { facility_id: string }[];
};
const runs = fixture.risk_runs as Record<string, Run>;
const panel = fixture.pilot;
// About the laptop county view: roughly 1,475 px per degree after fitting all markers.
const COUNTY_SCALE = 1475;

function view(magnitude: string) {
  const run = runs[magnitude];
  const risks = risksForRun(panel, run);
  const preShock = new Set(
    [...run.pre_shock_stockouts, ...run.baseline_stockouts].map(
      (row) => row.facility_id,
    ),
  );
  const points = panel.facilities.map((facility) => ({
    id: facility.id,
    x: facility.longitude * COUNTY_SCALE,
    y: -facility.latitude * COUNTY_SCALE,
    risk: risks[facility.id].status,
  }));
  return { risks, preShock, groups: clusterPoints(points) };
}

describe("clustering and risk counts on real version 5 runs (seed 42)", () => {
  it.each([
    [
      "0",
      [2, 0, 38],
      [
        "critical",
        "stable",
        "critical",
        "stable",
        "stable",
        "stable",
        "stable",
      ],
    ],
    [
      "20",
      [2, 5, 33],
      ["critical", "stable", "critical", "watch", "watch", "stable", "watch"],
    ],
    [
      "40",
      [10, 18, 12],
      [
        "critical",
        "watch",
        "critical",
        "critical",
        "critical",
        "critical",
        "watch",
      ],
    ],
    [
      "100",
      [40, 0, 0],
      [
        "critical",
        "critical",
        "critical",
        "critical",
        "critical",
        "critical",
        "critical",
      ],
    ],
  ] as const)(
    "at %s%% counts Critical/Watch/Stable and shows each cluster's worst status",
    (magnitude, [critical, watch, stable], worst) => {
      const { risks, preShock, groups } = view(magnitude);
      const summary = riskSummary(
        panel.facilities.map((facility) => facility.id),
        risks,
        preShock,
      );
      expect([summary.critical, summary.watch, summary.stable]).toEqual([
        critical,
        watch,
        stable,
      ]);
      expect(summary.unknown).toBe(0);
      expect(summary.total).toBe(40);
      expect(summary.alreadyShort).toBe(2);
      expect(groups.map((group) => group.length)).toEqual([
        6, 6, 6, 6, 6, 5, 5,
      ]);
      expect(
        groups.map((group) => worstStatus(group.map((p) => p.risk))),
      ).toEqual(worst);
    },
  );

  it("marks the planted pre-shock facilities as already short", () => {
    expect([...view("0").preShock].sort()).toEqual([
      "SYN-KE-042-F001",
      "SYN-KE-042-F003",
    ]);
  });
});

describe("cluster helpers", () => {
  it("groups points within the radius of a group's first point, in order", () => {
    const groups = clusterPoints([
      { x: 0, y: 0 },
      { x: CLUSTER_RADIUS_PX, y: 0 },
      { x: CLUSTER_RADIUS_PX + 1, y: 0 },
      { x: 500, y: 500 },
    ]);
    expect(groups.map((group) => group.length)).toEqual([2, 1, 1]);
    expect(
      clusterPoints([
        { x: 0, y: 0 },
        { x: 0, y: CLUSTER_RADIUS_PX + 1 },
      ]),
    ).toHaveLength(2);
  });

  it("orders worst status Critical, Watch, Unknown, Stable", () => {
    expect(worstStatus(["stable", "watch", "critical"])).toBe("critical");
    expect(worstStatus(["stable", "unknown"])).toBe("unknown");
    expect(worstStatus(["stable", "watch"])).toBe("watch");
    expect(worstStatus(["stable"])).toBe("stable");
    expect(worstStatus([])).toBe("unknown");
  });
});
