/** Planner-selected illustrative thresholds; not clinical or operational standards. */
export const RISK_THRESHOLDS = Object.freeze({
  criticalDays: 7,
  watchDays: 30,
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
  // Unknown is more cautious than stable when any tracer lacks a result.
  const priority: Record<Risk, number> = {
    critical: 4,
    watch: 3,
    unknown: 2,
    stable: 1,
  };
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
  if (locale === "sw") {
    return [
      `Hatari kubwa: bidhaa imeisha au itaisha ndani ya siku ${RISK_THRESHOLDS.criticalDays}`,
      `Angalizo: siku ${RISK_THRESHOLDS.criticalDays + 1}–${RISK_THRESHOLDS.watchDays}`,
      `Tulivu: bidhaa haitaisha ndani ya siku ${RISK_THRESHOLDS.watchDays}`,
      "Haijulikani: hakuna utabiri au uigaji",
      "Viwango ni vya mfano, si viwango vya kitabibu au kiutendaji.",
    ];
  }
  return [
    `Critical: already stocked out or within ${RISK_THRESHOLDS.criticalDays} days`,
    `Watch: ${RISK_THRESHOLDS.criticalDays + 1}–${RISK_THRESHOLDS.watchDays} days`,
    `Stable: no stockout within ${RISK_THRESHOLDS.watchDays} days`,
    "Unknown: no forecast or run is available",
    "Illustrative thresholds, not clinical or operational standards.",
  ];
}
