import { describe, expect, it } from "vitest";
import fixture from "../fixtures/kisumu.json";
import { risksForRun, riskSummary, worstStatus } from "../risk/risk";
import { CLUSTER_BOX, clusterPoints, clusterText } from "./map-clusters";

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
      ["critical", "critical", "stable", "stable", "stable", "stable"],
    ],
    [
      "20",
      [2, 5, 33],
      ["critical", "critical", "watch", "watch", "stable", "watch"],
    ],
    [
      "40",
      [10, 18, 12],
      ["critical", "critical", "critical", "critical", "critical", "watch"],
    ],
    [
      "100",
      [40, 0, 0],
      ["critical", "critical", "critical", "critical", "critical", "critical"],
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
      expect(groups.map((group) => group.length)).toEqual([12, 6, 6, 6, 5, 5]);
      expect(
        groups.map((group) => worstStatus(group.map((p) => p.risk))),
      ).toEqual(worst);
    },
  );

  it.each(["0", "20", "40", "100"])(
    "at %s%% each cluster label's status counts add up to the cluster size",
    (magnitude) => {
      const { risks, groups } = view(magnitude);
      let total = 0;
      for (const group of groups) {
        const counts = riskSummary(
          group.map((point) => point.id),
          risks,
        );
        const text = clusterText(group.length, counts, {
          critical: "Crit",
          watch: "Watch",
          stable: "Stable",
          unknown: "Unk",
        });
        const [size, ...parts] = text.split(" · ");
        expect(Number(size)).toBe(group.length);
        expect(
          parts.every((part) =>
            /^[1-9]\d* (Crit|Watch|Stable|Unk)$/.test(part),
          ),
        ).toBe(true);
        expect(
          parts.reduce((sum, part) => sum + Number(part.split(" ")[0]), 0),
        ).toBe(group.length);
        total += group.length;
      }
      expect(total).toBe(40);
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
  it("merges groups whose centres are within one pill box, keeping tight clusters whole", () => {
    const { width, height } = CLUSTER_BOX;
    const groups = clusterPoints([
      { x: 0, y: 0 },
      { x: width + 1, y: 0 },
      { x: 0, y: height },
      { x: 1000, y: 1000 },
      { x: 1001, y: 1001 },
    ]);
    expect(groups.map((group) => group.length)).toEqual([2, 1, 2]);
    expect(
      clusterPoints([
        { x: 0, y: 0 },
        { x: 0, y: height + 1 },
      ]),
    ).toHaveLength(2);
  });

  it("leaves no two cluster centres within one pill box on the real map at any scale", () => {
    for (const scale of [300, 600, 900, COUNTY_SCALE]) {
      const groups = clusterPoints(
        panel.facilities.map((facility) => ({
          x: facility.longitude * scale,
          y: -facility.latitude * scale,
        })),
      );
      const centres = groups.map((group) => ({
        x: group.reduce((sum, p) => sum + p.x, 0) / group.length,
        y: group.reduce((sum, p) => sum + p.y, 0) / group.length,
      }));
      for (let i = 0; i < centres.length; i++)
        for (let j = i + 1; j < centres.length; j++)
          expect(
            Math.abs(centres[i].x - centres[j].x) > CLUSTER_BOX.width ||
              Math.abs(centres[i].y - centres[j].y) > CLUSTER_BOX.height,
          ).toBe(true);
    }
  });

  it("orders worst status Critical, Watch, Unknown, Stable", () => {
    expect(worstStatus(["stable", "watch", "critical"])).toBe("critical");
    expect(worstStatus(["stable", "unknown"])).toBe("unknown");
    expect(worstStatus(["stable", "watch"])).toBe("watch");
    expect(worstStatus(["stable"])).toBe("stable");
    expect(worstStatus([])).toBe("unknown");
  });
});

it("formats the status mix worst first and skips empty statuses", () => {
  expect(
    clusterText(
      6,
      { critical: 2, watch: 3, stable: 1, unknown: 0 },
      {
        critical: "Crit",
        watch: "Watch",
        stable: "Stable",
        unknown: "Unk",
      },
    ),
  ).toBe("6 · 2 Crit · 3 Watch · 1 Stable");
  expect(
    clusterText(
      5,
      { critical: 0, watch: 0, stable: 4, unknown: 1 },
      {
        critical: "Crit",
        watch: "Watch",
        stable: "Stable",
        unknown: "Unk",
      },
    ),
  ).toBe("5 · 4 Stable · 1 Unk");
});
