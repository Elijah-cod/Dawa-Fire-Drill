"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import {
  fixCandidates,
  plannedFixes,
  type PlantedRoute,
  type ShockEvent,
} from "../api/candidates";
import type { components } from "../generated/api";
import { usePreferences } from "../preferences/preferences";
import { useTour } from "../tour/tour";

type Request = components["schemas"]["ModeledRequest"];
type Result = components["schemas"]["ModeledResponse"];

/** Default ceiling: enough for some planted transfers but not all, so the cut line is visible. */
export const DEFAULT_BUDGET = 30;

export function RankedFixes({
  runId,
  events,
  routes,
  rank,
}: {
  runId: string;
  events: ShockEvent[];
  routes: PlantedRoute[];
  rank: (body: Request) => Promise<Result>;
}) {
  const { t, locale } = usePreferences();
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [online, setOnline] = useState(true);
  const sequence = useRef(0);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      sequence.current++;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    const sync = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) {
        sequence.current++;
        if (timer.current) clearTimeout(timer.current);
        setStatus("idle");
      }
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "unreachable"
  >("idle");
  const fixes = plannedFixes(events, routes);
  const routeMatches = fixes.length > 0;
  const candidates: Request["candidates"] = fixCandidates(fixes);
  async function submit(ceiling: number) {
    started.current = true;
    const request = ++sequence.current;
    setStatus("loading");
    setResult(null);
    try {
      const response = await rank({
        synthetic_attested: true,
        budget: ceiling,
        candidates,
      });
      if (request !== sequence.current) return;
      if (
        !response.synthetic ||
        response.run_id !== runId ||
        response.selected_ids.some(
          (id) => !candidates.some((item) => item.id === id),
        )
      )
        throw new Error("Invalid optimizer response");
      setResult(response);
      setStatus("idle");
    } catch (error) {
      if (request !== sequence.current) return;
      setStatus(
        error instanceof ApiError &&
          error.status === 409 &&
          error.detail === "Benefit target cannot be met within the budget"
          ? "unreachable"
          : "error",
      );
    }
  }
  function name(id: string) {
    const [kind, number] = id.split("-");
    const fix = fixes.find((item) => String(item.index) === number);
    const label = kind === "transfer" ? t("rankTransfer") : t("rankEmergency");
    return fix
      ? `${label} → ${fix.event.facility_id} · ${fix.event.commodity_id}`
      : label;
  }
  function cost(id: string) {
    return candidates.find((item) => item.id === id)?.cost;
  }
  function deferral(id: string) {
    const effect = result?.effects.find((item) => item.id === id);
    return effect
      ? `${effect.deferred_days} ${t("rankDeferred")}`
      : t("rankDeferralUnavailable");
  }
  function reasonText(reason: string | undefined) {
    return reason === "remaining_budget_exceeded"
      ? t("rankRemainingBudget")
      : reason === "alternative_selected"
        ? t("rankAlternative")
        : reason === "cost_exceeds_ceiling"
          ? t("rankOverBudget")
          : reason === "donor_recipient_conflict"
            ? t("rankDonorConflict")
            : reason === "shared_inventory_constraint"
              ? t("rankInventory")
              : reason === "not_selected_by_optimal_set"
                ? t("rankNotSelected")
                : t("rankReasonUnavailable");
  }
  const { step } = useTour();
  useEffect(() => {
    // The guided demo ranks once at the default ceiling when it reaches this step.
    if (step === "rank" && routeMatches && online && !started.current)
      void submit(budget);
  }, [step, routeMatches, online]);
  return (
    <section className="panel rank-panel" aria-labelledby="ranked-title">
      <h2 id="ranked-title">{t("doThisFirst")}</h2>
      <p className="rank-intro">{t("rankIntro")}</p>
      {!routeMatches && <p role="status">{t("rankTransferUnavailable")}</p>}
      <details className="rank-details">
        <summary>{t("rankDetails")}</summary>
        <p>{t("rankAssumptions")}</p>
        <p>{t("rankCandidateAssumptions")}</p>
        {fixes.length > 0 && (
          <p>
            {t("rankTargets")}:{" "}
            {fixes
              .map(
                ({ event }) =>
                  `${event.facility_id} · ${event.commodity_id} · ${event.day} ${t("days")}`,
              )
              .join("; ")}
          </p>
        )}
      </details>
      <label htmlFor="rank-budget">{t("rankBudget")}</label>{" "}
      <input
        id="rank-budget"
        type="number"
        min="0"
        step="1"
        value={budget}
        onChange={(event) => {
          const next = Number(event.target.value);
          setBudget(next);
          sequence.current++;
          if (timer.current) clearTimeout(timer.current);
          setResult(null);
          setStatus("idle");
          if (
            routeMatches &&
            online &&
            started.current &&
            Number.isInteger(next) &&
            next >= 0 &&
            next <= 1000000000
          ) {
            setStatus("loading");
            timer.current = setTimeout(() => {
              void submit(next);
            }, 300);
          }
        }}
      />
      <button
        className="rank-action"
        type="button"
        disabled={
          !routeMatches ||
          !online ||
          status === "loading" ||
          !Number.isInteger(budget) ||
          budget < 0 ||
          budget > 1000000000
        }
        onClick={() => void submit(budget)}
      >
        {t("rankAction")}
      </button>
      <div className="rank-results">
        {status === "loading" && <p role="status">{t("rankLoading")}</p>}
        {!online && <p role="status">{t("rankOffline")}</p>}
        {status === "error" && <p role="alert">{t("rankError")}</p>}
        {status === "unreachable" && <p role="alert">{t("rankUnreachable")}</p>}
        {result && (
          <>
            <p>
              {t("rankUsed")}: {result.total_cost} KES · {t("rankRemaining")}:{" "}
              {result.remaining_budget} KES
            </p>
            <p className="rank-cost-note">{t("rankCostNote")}</p>
            <ol className="rank-selected" aria-label={t("rankAboveCut")}>
              {result.selected_ids.map((id) => (
                <li key={id}>
                  {name(id)} · {cost(id)} KES · {deferral(id)} ·{" "}
                  {t("rankSelected")}
                </li>
              ))}
            </ol>
            <p className="rank-cut">
              {t("rankCutLine")}: {t("rankCutLineDetail")}
            </p>
            <ul className="rank-excluded" aria-label={t("rankBelowCut")}>
              {candidates
                .filter((item) => !result.selected_ids.includes(item.id))
                .map(({ id }) => (
                  <li key={id}>
                    {name(id)} · {cost(id)} KES · {deferral(id)} ·{" "}
                    {reasonText(result.excluded_reasons[id])}
                  </li>
                ))}
            </ul>
            <h3>{t("rankExplanation")}</h3>
            {locale === "sw" && result.explanation && (
              <p>{t("rankEnglishOnly")}</p>
            )}
            <p lang={result.explanation ? "en" : undefined}>
              {result.explanation ?? t("rankNoExplanation")}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
