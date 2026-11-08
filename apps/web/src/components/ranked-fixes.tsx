"use client";

import { useEffect, useState } from "react";
export { FixesPlaceholder } from "./fixes-placeholder";
import type { PilotPanel } from "../api/client";
import { commodityLabel } from "../kisumu/names";
import type { Coverage } from "../kisumu/view";
import {
  BUDGET_MAX,
  BUDGET_STEP,
  type Ranking,
  type RankingState,
} from "../kisumu/use-ranking";
import { usePreferences } from "../preferences/preferences";

type Effect = Ranking["effects"][number];
type Key = Parameters<ReturnType<typeof usePreferences>["t"]>[0];

const REASONS: Record<string, Key> = {
  alternative_selected: "reasonAlternative",
  cost_exceeds_ceiling: "reasonOverBudget",
  remaining_budget_exceeded: "reasonRemaining",
  not_selected_by_optimal_set: "reasonNotSelected",
  donor_recipient_conflict: "reasonDonor",
  shared_inventory_constraint: "reasonInventory",
};

/** Equal effects mean either option of a pair gives the same modeled result. */
const sameEffect = (a?: Effect, b?: Effect) =>
  !!a &&
  !!b &&
  a.counterfactual_stockout_day === b.counterfactual_stockout_day &&
  a.deferred_days === b.deferred_days;

/** One sentence that restates why the optimizer picked what it did, from its own result. */
export function whySummary(
  ranking: RankingState,
  result: Ranking,
): { key: Key; vars?: Record<string, number> } {
  const cheapest = Math.min(...ranking.candidates.map((item) => item.cost));
  if (!result.selected_ids.length)
    return {
      key: "whyNone",
      vars: { c: cheapest, b: ranking.rankedBudget ?? ranking.budget },
    };
  const effect = (id: string) => result.effects.find((item) => item.id === id);
  const cost = (id: string) =>
    ranking.candidates.find((item) => item.id === id)?.cost ?? 0;
  const same = ranking.fixes.every(
    ({ index }) =>
      sameEffect(effect(`transfer-${index}`), effect(`emergency-${index}`)) &&
      cost(`transfer-${index}`) < cost(`emergency-${index}`),
  );
  const onlyTransfers = result.selected_ids.every((id) =>
    id.startsWith("transfer-"),
  );
  return same && onlyTransfers ? { key: "whySame" } : { key: "whyGeneral" };
}

/**
 * Paired options for each covered stockout, a live budget slider with the cut line, and the
 * optimizer's own explanation behind "Why these picks?". OR-Tools decides; nothing here
 * changes a ranking.
 */
export function RankedFixes({
  panel,
  ranking,
  coverage,
  noFix,
}: {
  panel: PilotPanel;
  ranking: RankingState;
  coverage: Coverage | null;
  /** Why nothing can be ranked at this shock, when that is the case. */
  noFix?: { title: string; text: string; budget: string };
}) {
  const { t, tf, locale } = usePreferences();
  const { budget, rankedBudget, result, status, fixes, candidates } = ranking;
  // The number field commits on change (blur or Enter); typing does not re-rank per keystroke.
  const [draft, setDraft] = useState(String(budget));
  useEffect(() => setDraft(String(budget)), [budget]);
  const facility = (id: string) => panel.facilities.find((f) => f.id === id);
  const area = (id: string) =>
    panel.subcounties.find((s) => s.id === facility(id)?.subcounty_id)?.name ??
    "";
  const medicine = (id: string) =>
    commodityLabel(panel.commodities, id, locale).toLocaleLowerCase(locale);
  const head = (
    <>
      <h2 id="fixes-title">{t("fixesTitle")}</h2>
      <p className="sub">
        {coverage &&
          tf("fixesScope", {
            coverage: coverage.earliest
              ? tf("fixesCoverEarliest", {
                  n: coverage.count,
                  total: coverage.total,
                })
              : tf("fixesCoverSome", {
                  n: coverage.count,
                  total: coverage.total,
                  first: coverage.first,
                  last: coverage.last,
                }),
          }) + " "}
        {t("fixesHow")}
      </p>
    </>
  );
  const control = (disabled: boolean) => (
    <>
      <label className="field-label" htmlFor="budget">
        {t("fixesBudget")}
      </label>
      <div className="budget-control">
        <input
          id="budget"
          type="range"
          min="0"
          max={BUDGET_MAX}
          step={BUDGET_STEP}
          value={budget}
          disabled={disabled}
          aria-describedby="budget-status"
          onChange={(event) => ranking.setBudget(Number(event.target.value))}
        />
        <input
          id="budget-number"
          type="number"
          min="0"
          max={BUDGET_MAX}
          step={BUDGET_STEP}
          value={draft}
          disabled={disabled}
          aria-label={t("fixesBudgetNumber")}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => ranking.setBudget(Number(draft))}
          onKeyDown={(event) => {
            if (event.key === "Enter") ranking.setBudget(Number(draft));
          }}
        />
      </div>
    </>
  );
  if (noFix)
    return (
      <section className="panel fixes" aria-labelledby="fixes-title">
        {head}
        {control(true)}
        <p className="state" id="budget-status">
          {noFix.budget}
        </p>
        <div className="finding" role="status">
          <strong>{noFix.title}</strong> {noFix.text}
        </div>
      </section>
    );
  const cheapest = Math.min(...candidates.map((item) => item.cost));
  const effect = (id: string) => result?.effects.find((item) => item.id === id);
  const effectText = (item?: Effect) =>
    !item
      ? t("effectUnknown")
      : item.counterfactual_stockout_day === null
        ? tf("effectHolds", { h: 90 })
        : tf("effectMoves", { day: item.counterfactual_stockout_day });
  let x = 0;
  const segments = (result?.selected_ids ?? []).map((id) => {
    const cost = candidates.find((item) => item.id === id)?.cost ?? 0;
    const segment = (
      <span
        key={id}
        className="seg"
        style={{ left: `${x}%`, width: `${cost}%` }}
      />
    );
    x += cost;
    return segment;
  });
  let message;
  if (status === "error" || status === "unreachable")
    message = (
      <div className="state state--error" role="alert" id="budget-status">
        <span>
          {status === "unreachable"
            ? t("rankUnreachable")
            : rankedBudget === null
              ? tf("fixesFailedFirst", { b: budget })
              : rankedBudget === budget
                ? tf("fixesRefreshFailed", { b: budget })
                : tf("fixesFailed", { b: budget, r: rankedBudget })}
        </span>
        <button type="button" className="btn" onClick={ranking.retry}>
          {t("fixesRetry")}
        </button>
      </div>
    );
  else if (status === "offline")
    message = (
      <p className="state" role="status" id="budget-status">
        {t("rankOffline")}
      </p>
    );
  else if (status === "loading" || !result)
    message = (
      <p className="state" role="status" id="budget-status">
        {rankedBudget === null
          ? tf("fixesFirstRank", { b: budget })
          : tf("fixesInFlight", { b: budget, r: rankedBudget })}
      </p>
    );
  else if (!result.selected_ids.length)
    message = (
      <p className="state" role="status" id="budget-status">
        {tf("fixesNothingFits", { b: rankedBudget ?? budget, c: cheapest })}
      </p>
    );
  else
    message = (
      <p className="state" role="status" id="budget-status">
        {tf("fixesUsed", {
          used: result.total_cost,
          b: rankedBudget ?? budget,
        })}
      </p>
    );
  const why = result && whySummary(ranking, result);
  const explanation = result?.explanation
    ?.replace(/^Illustrative and unvalidated\.\s*/, "")
    .replace(/\b(transfer|emergency)-(\d+)\b/g, (id, kind, number) => {
      const fix = fixes.find((item) => String(item.index) === number);
      if (!fix) return id;
      const to = `${facility(fix.event.facility_id)?.name ?? fix.event.facility_id} (${commodityLabel(panel.commodities, fix.event.commodity_id).toLowerCase()})`;
      // The explanation is English-only, so the names inside it stay English too.
      return kind === "transfer"
        ? `the transfer to ${to}`
        : `emergency delivery to ${to}`;
    });
  return (
    <section className="panel fixes" aria-labelledby="fixes-title">
      {head}
      {control(false)}
      <div className="budget-bar" aria-hidden="true">
        {segments}
        <span
          className="cut"
          style={{ left: `${(budget / BUDGET_MAX) * 100}%` }}
        >
          <span>{tf("units", { n: budget })}</span>
        </span>
      </div>
      <div className="budget-status-slot">{message}</div>
      <ol className="pairs" id="pairs" aria-busy={status === "loading"}>
        {fixes.map(({ index, event, route }) => {
          const transfer = `transfer-${index}`;
          const emergency = `emergency-${index}`;
          const same =
            !!result && sameEffect(effect(transfer), effect(emergency));
          const option = (id: string, kind: "transfer" | "emergency") => {
            const funded = !!result?.selected_ids.includes(id);
            const cost = candidates.find((item) => item.id === id)?.cost;
            return (
              <li
                className={`option ${funded ? "option--funded" : "option--cut"}`}
                data-funded={funded || undefined}
              >
                <span className="name">
                  {kind === "transfer" ? (
                    <>
                      {t("optionTransfer")}
                      <span className="via">
                        {tf("optionVia", {
                          name:
                            facility(route.donor_facility_id)?.name ??
                            route.donor_facility_id,
                          km: route.distance_km,
                        })}
                      </span>
                    </>
                  ) : (
                    t("optionEmergency")
                  )}
                </span>
                <span className="cost">{tf("units", { n: cost ?? "—" })}</span>
                {result && (
                  <span className="why">
                    {funded ? (
                      <>
                        <svg
                          className="icon icon--sm"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M8 12.5l2.5 2.5L16 9.5" />
                        </svg>
                        {t("funded")}
                      </>
                    ) : (
                      tf("notFunded", {
                        reason: t(
                          REASONS[result.excluded_reasons[id] ?? ""] ??
                            "reasonUnknown",
                        ),
                      })
                    )}
                    {!same &&
                      ` · ${tf("ifFunded", { effect: effectText(effect(id)) })}`}
                  </span>
                )}
              </li>
            );
          };
          return (
            <li className="pair" key={index}>
              <h3>
                {tf("pairTitle", {
                  name: facility(event.facility_id)?.name ?? event.facility_id,
                  medicine: medicine(event.commodity_id),
                })}
              </h3>
              <p className="meta">
                {tf("pairMeta", {
                  area: area(event.facility_id),
                  day: event.day,
                })}
                {same &&
                  ` · ${tf("pairSame", { effect: effectText(effect(transfer)) })}`}
              </p>
              <ul className="options">
                {option(transfer, "transfer")}
                {option(emergency, "emergency")}
              </ul>
            </li>
          );
        })}
      </ol>
      {why && (
        <div className="explain">
          <p className="explain-summary">{tf(why.key, why.vars ?? {})}</p>
          <details>
            <summary>{t("whyTitle")}</summary>
            {locale === "sw" && explanation && <p>{t("rankEnglishOnly")}</p>}
            <p lang={explanation ? "en" : undefined}>
              {explanation ?? t("rankNoExplanation")}
            </p>
          </details>
        </div>
      )}
    </section>
  );
}
