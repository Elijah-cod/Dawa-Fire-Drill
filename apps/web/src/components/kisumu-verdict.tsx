"use client";

import type { ReactNode } from "react";
import type { PilotPanel } from "../api/client";
import type { PlantedRoute } from "../api/candidates";
import { commodityLabel } from "../kisumu/names";
import { coverage, lateRoutes, type RunEvents } from "../kisumu/view";
import type { RankingState } from "../kisumu/use-ranking";
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
  if (magnitude === null) {
    // Before the first run arrives: the page's question at full size. The verdict replaces
    // it; the lines after it are new, inside the section's reserved height, so nothing
    // moves. The scenario panel announces the run status meanwhile.
    lead = t("verdictFraming");
    fix = null;
  } else if (!events) lead = t("verdictUnavailable");
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
        <a
          className="inline-control"
          href="#stockout-order"
          onClick={(event) => {
            event.preventDefault();
            onShowOrder();
          }}
        >
          {tf(count === 1 ? "verdictStockout" : "verdictStockouts", {
            n: count,
          })}
        </a>
      ),
      place: (
        <a
          className="inline-control"
          href="#facility-detail"
          onClick={(event) => {
            event.preventDefault();
            onShowFacility(first.facility_id);
          }}
        >
          {tf("verdictPlace", {
            name: facility(first.facility_id)?.name ?? first.facility_id,
            area: area(first.facility_id),
          })}
        </a>
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

/**
 * The verdict's budget sentence, restating the ranking on screen: how many fixes the
 * optimizer funds at the ranked budget and which transfer the cut line leaves out.
 */
export function BudgetSentence({
  panel,
  ranking,
  onShowFunded,
}: {
  panel: PilotPanel;
  ranking: RankingState;
  onShowFunded: () => void;
}) {
  const { tf, tn } = usePreferences();
  const { result, rankedBudget, budget, candidates, fixes, status } = ranking;
  if (!result || rankedBudget === null)
    return (
      <>
        {status === "error"
          ? tf("fixesFailedFirst", { b: budget })
          : tf("fixesFirstRank", { b: budget })}
      </>
    );
  const cheapest = Math.min(...candidates.map((item) => item.cost));
  const selected = result.selected_ids;
  if (!selected.length)
    return <>{tf("verdictNothingFits", { b: rankedBudget, c: cheapest })}</>;
  const transfers = selected.every((id) => id.startsWith("transfer-"));
  const holds = selected.every(
    (id) =>
      result.effects.find((item) => item.id === id)
        ?.counterfactual_stockout_day === null,
  );
  const n = selected.length;
  const noun = transfers
    ? n === 1
      ? "verdictTransfer"
      : "verdictTransfers"
    : n === 1
      ? "verdictFixN"
      : "verdictFixesN";
  const cut = Object.entries(result.excluded_reasons)
    .filter(
      ([id, reason]) =>
        id.startsWith("transfer-") && reason === "remaining_budget_exceeded",
    )
    .map(([id]) => fixes.find((fix) => `transfer-${fix.index}` === id))
    .filter((fix) => fix !== undefined);
  return (
    <>
      {tn("verdictBudget", {
        b: rankedBudget,
        funded: (
          <a
            className="inline-control"
            href="#pairs"
            onClick={(event) => {
              event.preventDefault();
              onShowFunded();
            }}
          >
            {tf(noun, { n })}
          </a>
        ),
        cost: result.total_cost,
        hold: holds
          ? tf(n === 1 ? "verdictHoldOne" : "verdictHoldEach", { h: 90 })
          : "",
      })}
      {cut.length === 1 &&
        ` ${tf("verdictCutOne", {
          name:
            panel.facilities.find((f) => f.id === cut[0].event.facility_id)
              ?.name ?? cut[0].event.facility_id,
          day: cut[0].event.day,
        })}`}
      {cut.length > 1 && ` ${tf("verdictCutMany", { n: cut.length })}`}
    </>
  );
}
