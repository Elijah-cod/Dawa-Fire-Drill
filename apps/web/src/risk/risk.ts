/** Planner-selected illustrative thresholds; not clinical or operational standards. */
// Tuned on 2026-11-08 to make the seed-42 generator version 5 scenario readable (first
// 40% shock stockout on day 41); relative to the 90-day horizon, not a standard.
export const RISK_THRESHOLDS = Object.freeze({
  criticalDays: 45,
  watchDays: 52,
  horizonDays: 90,
});
export type Risk = "critical" | "watch" | "stable" | "unknown";
export type CommodityRisk = {
  commodityId: string;
  days: number | null | undefined;
};
export type FacilityRisk = {
  status: Risk;
  drivers: string[];
  days: number | null;
};
type RiskPanel = {
  facilities: { id: string }[];
  commodities: { id: string }[];
  consumption: {
    facility_id: string;
    commodity_id: string;
    month_index: number;
  }[];
  stock: { facility_id: string; commodity_id: string; opening_stock: number }[];
};
type RiskRun = {
  horizon_days: number;
  stockouts: { facility_id: string; commodity_id: string; day: number }[];
};

/** Worst first; Unknown is more cautious than Stable when a result is missing. */
export const RISK_PRIORITY: Readonly<Record<Risk, number>> = Object.freeze({
  critical: 4,
  watch: 3,
  unknown: 2,
  stable: 1,
});

/** The most severe status in a group, e.g. a map cluster. */
export function worstStatus(statuses: Risk[]): Risk {
  return statuses.reduce<Risk>(
    (worst, status) =>
      RISK_PRIORITY[status] > RISK_PRIORITY[worst] ? status : worst,
    statuses.length ? "stable" : "unknown",
  );
}

export type RiskSummary = Record<Risk, number> & {
  total: number;
  alreadyShort: number;
};

/** Counts per status for the given facilities, plus those short regardless of the shock. */
export function riskSummary(
  facilityIds: string[],
  risks: Record<string, FacilityRisk>,
  preShock: ReadonlySet<string> = new Set(),
): RiskSummary {
  const summary: RiskSummary = {
    critical: 0,
    watch: 0,
    stable: 0,
    unknown: 0,
    total: facilityIds.length,
    alreadyShort: 0,
  };
  for (const id of facilityIds) {
    summary[risks[id]?.status ?? "unknown"]++;
    if (preShock.has(id)) summary.alreadyShort++;
  }
  return summary;
}

export function classifyDays(days: number | null | undefined): Risk {
  if (
    days === undefined ||
    (typeof days === "number" && (!Number.isFinite(days) || days < 0))
  )
    return "unknown";
  if (days === null || days > RISK_THRESHOLDS.watchDays) return "stable";
  if (days <= RISK_THRESHOLDS.criticalDays) return "critical";
  return "watch";
}

export function facilityRisk(commodities: CommodityRisk[]): FacilityRisk {
  if (!commodities.length)
    return { status: "unknown", drivers: [], days: null };
  const priority = RISK_PRIORITY;
  const classified = commodities.map((item) => ({
    ...item,
    status: classifyDays(item.days),
  }));
  const status = classified.reduce<Risk>(
    (worst, item) =>
      priority[item.status] > priority[worst] ? item.status : worst,
    "stable",
  );
  const driving = classified.filter((item) => item.status === status);
  const days = driving.flatMap((item) =>
    typeof item.days === "number" &&
    Number.isFinite(item.days) &&
    item.days >= 0
      ? [item.days]
      : [],
  );
  return {
    status,
    drivers: driving.map((item) => item.commodityId),
    days: days.length ? Math.min(...days) : null,
  };
}

/** Derive risk only where the pinned panel actually supplies that tracer's inputs. */
export function risksForRun(
  panel: RiskPanel,
  run: RiskRun | null,
): Record<string, FacilityRisk> {
  const key = (facility: string, commodity: string) =>
    `${facility}\0${commodity}`;
  const consumption = new Set(
    panel.consumption
      .filter((row) => row.month_index === 23)
      .map((row) => key(row.facility_id, row.commodity_id)),
  );
  const stocks = new Map(
    panel.stock.map((row) => [
      key(row.facility_id, row.commodity_id),
      row.opening_stock,
    ]),
  );
  const events = new Map(
    (run?.stockouts ?? []).map((row) => [
      key(row.facility_id, row.commodity_id),
      row.day,
    ]),
  );
  return Object.fromEntries(
    panel.facilities.map((facility) => [
      facility.id,
      facilityRisk(
        panel.commodities.map((commodity) => {
          const pair = key(facility.id, commodity.id);
          const opening = stocks.get(pair);
          const event = events.get(pair);
          let days: number | null | undefined;
          if (run && consumption.has(pair) && opening !== undefined) {
            if (opening === 0) days = 0;
            else if (event !== undefined) days = event;
            else if (run.horizon_days >= RISK_THRESHOLDS.watchDays) days = null;
          }
          return { commodityId: commodity.id, days };
        }),
      ),
    ]),
  );
}

export function riskLegend(locale: "en" | "sw" = "en"): string[] {
  const { criticalDays, watchDays, horizonDays } = RISK_THRESHOLDS;
  if (locale === "sw") {
    return [
      `Hatari kubwa: haina akiba tangu mwanzo au kuisha kwa kwanza kufikia siku ya ${criticalDays}`,
      `Angalizo: kuisha kwa kwanza siku ${criticalDays + 1}–${watchDays}`,
      `Baadaye: kuisha kwa kwanza baada ya siku ya ${watchDays}, au hakuna katika jaribio`,
      "Haijulikani: hakuna utabiri au uigaji",
      `Viwango hivi ni vya jaribio zima la siku ${horizonDays} na havibadiliki na siku iliyochaguliwa kwenye mstari wa wakati. Vilirekebishwa ili mfano huu wa kubuni usomeke; ni vya mfano, si kiwango rasmi.`,
      "Viwango ni vya mfano, si viwango vya kitabibu au kiutendaji.",
    ];
  }
  return [
    `Critical: out of stock at the start, or first stockout by day ${criticalDays}`,
    `Watch: first stockout on days ${criticalDays + 1}–${watchDays}`,
    `Later: first stockout after day ${watchDays}, or none in the run`,
    "Unknown: no forecast or run is available",
    `These thresholds are fixed for the whole ${horizonDays}-day run and do not change with the selected timeline day. They were tuned to make this synthetic scenario readable; they are illustrative, not a standard.`,
    "Illustrative thresholds, not clinical or operational standards.",
  ];
}
