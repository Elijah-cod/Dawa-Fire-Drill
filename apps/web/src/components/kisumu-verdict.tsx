"use client";

import type { ReactNode } from "react";
import type { PilotPanel } from "../api/client";
import type { PlantedRoute } from "../api/candidates";
import { commodityLabel } from "../kisumu/names";
import { coverage, lateRoutes, type RunEvents } from "../kisumu/view";
import { usePreferences } from "../preferences/preferences";

export type StatusCounts = { critical: number; watch: number; stable: number };

/**
 * The answer first: what breaks first under the shown run, how far the fixes reach, and the
 * facts behind it. Every number comes from the backend run; the teal phrases are real controls.
 */
export function KisumuVerdict({
  panel,
  routes,
  magnitude,
  events,
  counts,
  busy,
  budgetLine,
  onShowOrder,
  onShowFacility,
}: {
  panel: PilotPanel;
  routes: PlantedRoute[];
  /** The shock of the run on screen, which trails the selection while a run is in flight. */
  magnitude: number | null;
  events: RunEvents | null;
  counts: StatusCounts | null;
  busy: boolean;
  /** The budget sentence from the fixes, when a ranking is on screen. */
  budgetLine?: ReactNode;
  onShowOrder: () => void;
  onShowFacility: (id: string) => void;
}) {
  const { t, tf, tn, locale } = usePreferences();
  const horizon = 90;
  const facility = (id: string) => panel.facilities.find((f) => f.id === id);
  const area = (id: string) =>
    panel.subcounties.find((s) => s.id === facility(id)?.subcounty_id)?.name ??
    "";
  let lead: ReactNode;
  let scope: string | null = null;
  let fix: ReactNode = budgetLine ?? null;
  if (magnitude === null) lead = t("overviewLoading");
  else if (!events) lead = t("verdictUnavailable");
  else if (magnitude === 0) {
    lead = tf("verdictNoShock", { h: horizon });
    fix = t("verdictNothingToFix");
  } else if (!events.shock.length) {
    lead = tf("verdictNone", { n: magnitude, h: horizon });
    fix = t("verdictNothingToFix");
  } else {
    const first = events.shock[0];
    const count = events.shock.length;
    lead = tn("verdictLead", {
      n: magnitude,
      h: horizon,
      count: (
        <button type="button" className="inline-control" onClick={onShowOrder}>
          {tf(count === 1 ? "verdictStockout" : "verdictStockouts", {
            n: count,
          })}
        </button>
      ),
      place: (
        <button
          type="button"
          className="inline-control"
          onClick={() => onShowFacility(first.facility_id)}
        >
          {tf("verdictPlace", {
            name: facility(first.facility_id)?.name ?? first.facility_id,
            area: area(first.facility_id),
          })}
        </button>
      ),
      medicine: commodityLabel(
        panel.commodities,
        first.commodity_id,
        locale,
      ).toLocaleLowerCase(locale),
      day: first.day,
    });
    const covered = coverage(events.shock, routes);
    if (covered)
      scope = covered.earliest
        ? tf("verdictScopeEarliest", { n: covered.count, total: covered.total })
        : tf("verdictScopeSome", {
            n: covered.count,
            total: covered.total,
            first: covered.first,
            last: covered.last,
          });
    else {
      const late = lateRoutes(events.shock, routes);
      if (late)
        fix = tf("verdictLate", {
          n: late.routes,
          arrival: late.arrival,
          day: late.day,
        });
    }
  }
  const short = events?.alreadyShort ?? [];
  const shortList = short.map((item) =>
    tf("factsShortItem", {
      name: facility(item.facility_id)?.name ?? item.facility_id,
      day: item.day,
    }),
  );
  const joined =
    shortList.length < 2
      ? shortList.join("")
      : `${shortList.slice(0, -1).join(", ")} ${t("and")} ${shortList.at(-1)}`;
  return (
    <section
      className="verdict"
      id="verdict"
      aria-label={t("verdictLabel")}
      aria-live="polite"
      aria-busy={busy}
      data-busy={busy || undefined}
    >
      <p className="verdict-line verdict-lead">{lead}</p>
      {scope && <p className="verdict-line verdict-scope">{scope}</p>}
      <p className="verdict-line verdict-fix">{fix}</p>
      {events && (
        <ul className="verdict-facts">
          <li>
            {tn("factsTotal", {
              total: <strong>{events.all.length}</strong>,
              caused: events.shock.length,
              short: short.length,
            })}
            {short.length > 0 && ` (${joined})`}
          </li>
          {counts && <li>{tf("factsStatus", counts)}</li>}
        </ul>
      )}
    </section>
  );
}
