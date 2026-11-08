import {
  plannedFixes,
  type PlantedRoute,
  type ShockEvent,
} from "../api/candidates";

export type RunEvents = {
  /** Every stockout in the run. */
  all: ShockEvent[];
  /** Stockouts the backend attributes to the shock, earliest first. */
  shock: ShockEvent[];
  /** Opening gaps and stockouts that also happen with no shock, earliest first. */
  alreadyShort: ShockEvent[];
};

function validEvents(value: unknown): value is ShockEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        row &&
        typeof row.facility_id === "string" &&
        typeof row.commodity_id === "string" &&
        Number.isInteger(row.day) &&
        row.day >= 0,
    )
  );
}

const byDay = (a: ShockEvent, b: ShockEvent) =>
  a.day - b.day || a.facility_id.localeCompare(b.facility_id);

/** The backend's event lists for a synthetic Kisumu run, or null when any is missing. */
export function runEvents(
  result: Record<string, unknown> | null | undefined,
): RunEvents | null {
  if (!result || result.synthetic !== true || result.county_code !== "042")
    return null;
  const { stockouts, shock_caused_stockouts, pre_shock_stockouts } = result;
  const baseline = result.baseline_stockouts;
  if (
    !validEvents(stockouts) ||
    !validEvents(shock_caused_stockouts) ||
    !validEvents(pre_shock_stockouts) ||
    !validEvents(baseline)
  )
    return null;
  return {
    all: stockouts,
    shock: [...shock_caused_stockouts].sort(byDay),
    alreadyShort: [...pre_shock_stockouts, ...baseline].sort(byDay),
  };
}

export type Coverage = {
  /** Stockouts with a ranked option. */
  count: number;
  /** All shock-caused stockouts. */
  total: number;
  /** True only when the covered stockouts are exactly the earliest ones by day. */
  earliest: boolean;
  first: number;
  last: number;
};

/** How many shock-caused stockouts the planted fixes address; null when none can. */
export function coverage(
  shock: ShockEvent[],
  routes: PlantedRoute[],
): Coverage | null {
  const days = plannedFixes(shock, routes)
    .map((fix) => fix.event.day)
    .sort((a, b) => a - b);
  if (!days.length) return null;
  const earliest = shock
    .map((event) => event.day)
    .sort((a, b) => a - b)
    .slice(0, days.length);
  return {
    count: days.length,
    total: shock.length,
    earliest: days.every((day, index) => day === earliest[index]),
    first: days[0],
    last: days[days.length - 1],
  };
}

/** Why no planted transfer can help: they arrive after their stockouts. */
export function lateRoutes(shock: ShockEvent[], routes: PlantedRoute[]) {
  const days = routes.flatMap((route) => {
    const event = shock.find(
      (item) =>
        item.facility_id === route.facility_id &&
        item.commodity_id === route.commodity_id,
    );
    return event ? [event.day] : [];
  });
  if (!routes.length || !days.length) return null;
  return {
    routes: routes.length,
    arrival: Math.min(...routes.map((route) => route.arrival_day)),
    day: Math.max(...days),
  };
}
