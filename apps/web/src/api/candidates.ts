import type { components } from "../generated/api";

type Candidate = components["schemas"]["ModeledRequest"]["candidates"][number];
export type ShockEvent = {
  facility_id: string;
  commodity_id: string;
  day: number;
};
export type PlantedRoute = {
  synthetic?: boolean;
  donor_facility_id: string;
  facility_id: string;
  commodity_id: string;
  quantity: number;
  available_units: number;
  dispatch_day: number;
  arrival_day: number;
  expiry_day: number;
  minimum_shelf_days: number;
  distance_km: number;
  maximum_distance_km: number;
};
export type PlannedFix = {
  index: number;
  event: ShockEvent;
  route: PlantedRoute;
};

/** Illustrative assumed costs in KES; not observed prices. */
export const TRANSFER_COST = 10;
export const EMERGENCY_COST = 50;

/** Pair each planted synthetic route with the shock-caused stockout it targets, earliest first. */
export function plannedFixes(
  events: ShockEvent[],
  routes: PlantedRoute[],
): PlannedFix[] {
  return routes
    .flatMap((route) => {
      const event = events.find(
        (item) =>
          item.facility_id === route.facility_id &&
          item.commodity_id === route.commodity_id,
      );
      return route.synthetic === true && event && route.arrival_day <= event.day
        ? [{ event, route }]
        : [];
    })
    .sort((a, b) => a.event.day - b.event.day)
    .map((item, index) => ({ ...item, index: index + 1 }));
}

/** One transfer and one emergency delivery per planned fix, with the same quantity and arrival. */
export function fixCandidates(fixes: PlannedFix[]): Candidate[] {
  return fixes.flatMap(({ index, route }) => [
    {
      id: `transfer-${index}`,
      kind: "redistribution" as const,
      cost: TRANSFER_COST,
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
      id: `emergency-${index}`,
      kind: "emergency_procurement" as const,
      cost: EMERGENCY_COST,
      facility_id: route.facility_id,
      commodity_id: route.commodity_id,
      arrival_day: route.arrival_day,
      quantity: route.quantity,
    },
  ]);
}
