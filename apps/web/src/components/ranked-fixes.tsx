"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import type { components } from "../generated/api";
import { usePreferences } from "../preferences/preferences";

type Request = components["schemas"]["ModeledRequest"];
type Result = components["schemas"]["ModeledResponse"];
type Target = { facility_id: string; commodity_id: string; day: number };

export function RankedFixes({
  runId,
  target,
  rank,
}: {
  runId: string;
  target: Target;
  rank: (body: Request) => Promise<Result>;
}) {
  const { t } = usePreferences();
  const [budget, setBudget] = useState(100);
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
  const candidates: Request["candidates"] = [10, 50].map((cost, index) => ({
    id: index === 0 ? "first-cheap" : "first-costly",
    kind: "emergency_procurement",
    cost,
    facility_id: target.facility_id,
    commodity_id: target.commodity_id,
    arrival_day: target.day,
    quantity: 10000,
  }));
  async function submit(ceiling: number) {
    started.current = true;
    const request = ++sequence.current;
    setStatus("loading");
    setResult(null);
    try {
      const response = await rank({
        synthetic_attested: true,
        budget: ceiling,
        minimum_benefit: 1,
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
  return (
    <section className="panel" aria-labelledby="ranked-title">
      <h2 id="ranked-title">{t("doThisFirst")}</h2>
      <p>{t("rankAssumptions")}</p>
      <p>{t("rankCandidateAssumptions")}</p>
      <p>
        {t("rankTarget")}: {target.facility_id} · {target.commodity_id} ·{" "}
        {target.day} {t("days")}
      </p>
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
          <ol className="rank-selected">
            {result.selected_ids.map((id) => (
              <li key={id}>
                {id} · {candidates.find((item) => item.id === id)?.cost} KES ·{" "}
                {t("rankSelected")}
                {result.effects.find((effect) => effect.id === id) && (
                  <p>
                    {
                      result.effects.find((effect) => effect.id === id)
                        ?.deferred_days
                    }{" "}
                    {t("rankDeferred")}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="rank-cut">
            {t("rankCutLine")}: {result.cut_line}
          </p>
          {Object.entries(result.excluded_reasons).map(([id, reason]) => (
            <p key={id}>
              {id} ·{" "}
              {reason === "alternative_selected"
                ? t("rankAlternative")
                : reason === "cost_exceeds_ceiling"
                  ? t("rankOverBudget")
                  : reason === "donor_recipient_conflict"
                    ? t("rankDonorConflict")
                    : reason === "shared_inventory_constraint"
                      ? t("rankInventory")
                      : reason === "not_selected_by_optimal_set"
                        ? t("rankNotSelected")
                        : t("rankReasonUnavailable")}
            </p>
          ))}
          <h3>{t("rankExplanation")}</h3>
          <p>{result.explanation ?? t("rankNoExplanation")}</p>
        </>
      )}
    </section>
  );
}
