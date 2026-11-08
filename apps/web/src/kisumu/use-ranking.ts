"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client";
import {
  fixCandidates,
  plannedFixes,
  type PlannedFix,
  type PlantedRoute,
  type ShockEvent,
} from "../api/candidates";
import type { components } from "../generated/api";

type Request = components["schemas"]["ModeledRequest"];
export type Ranking = components["schemas"]["ModeledResponse"];

/** Default ceiling in illustrative cost units: some planted transfers fit, not all. */
export const DEFAULT_BUDGET = 30;
export const BUDGET_MAX = 100;
export const BUDGET_STEP = 5;
/** The backend ranking call waits for the slider to settle. */
export const RANK_DEBOUNCE_MS = 350;

export const snapBudget = (value: number) =>
  Number.isFinite(value)
    ? Math.min(
        BUDGET_MAX,
        Math.max(0, Math.round(value / BUDGET_STEP) * BUDGET_STEP),
      )
    : DEFAULT_BUDGET;

export type RankingState = {
  /** The budget the slider shows. */
  budget: number;
  /** The budget whose ranking is on screen; it trails `budget` while a ranking is in flight. */
  rankedBudget: number | null;
  result: Ranking | null;
  status: "idle" | "loading" | "error" | "unreachable" | "offline";
  fixes: PlannedFix[];
  candidates: Request["candidates"];
  setBudget: (value: number) => void;
  retry: () => void;
};

/**
 * Ranks the planted fixes for one run with OR-Tools through the backend. The first ranking
 * starts at once; later budget changes are debounced, and a late older response never
 * replaces a newer one. The last ranking stays on screen while the next one is in flight.
 */
export function useRanking({
  runId,
  events,
  routes,
  rank,
  initialBudget = DEFAULT_BUDGET,
}: {
  /** The budget a shared link asked for. */
  initialBudget?: number;
  runId: string | null;
  events: ShockEvent[];
  routes: PlantedRoute[];
  rank?: (body: Request) => Promise<Ranking>;
}): RankingState {
  const fixes = useMemo(() => plannedFixes(events, routes), [events, routes]);
  const candidates = useMemo(() => fixCandidates(fixes), [fixes]);
  const [budget, setBudgetState] = useState(() => snapBudget(initialBudget));
  const [result, setResult] = useState<Ranking | null>(null);
  const [rankedBudget, setRankedBudget] = useState<number | null>(null);
  const [status, setStatus] = useState<RankingState["status"]>("idle");
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ budget, runId, candidates, rank });
  latest.current = { budget, runId, candidates, rank };

  async function submit(ceiling: number) {
    const { runId: id, candidates: options, rank: call } = latest.current;
    if (!id || !call || !options.length) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    const request = ++sequence.current;
    setStatus("loading");
    try {
      const response = await call({
        synthetic_attested: true,
        budget: ceiling,
        candidates: options,
      });
      if (request !== sequence.current) return;
      if (
        !response.synthetic ||
        response.run_id !== id ||
        response.selected_ids.some(
          (item) => !options.some((option) => option.id === item),
        )
      )
        throw new Error("Invalid optimizer response");
      setResult(response);
      setRankedBudget(ceiling);
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

  // A new run or candidate set starts over with the current budget. The key is a value, so
  // callers that rebuild equal arrays on each render do not trigger a new ranking.
  const key = `${runId}:${JSON.stringify(candidates)}`;
  useEffect(() => {
    sequence.current++;
    setResult(null);
    setRankedBudget(null);
    setStatus("idle");
    void submit(latest.current.budget);
    return () => {
      sequence.current++;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key]);

  useEffect(() => {
    const sync = () => {
      if (navigator.onLine) void submit(latest.current.budget);
      else {
        sequence.current++;
        if (timer.current) clearTimeout(timer.current);
        setStatus("offline");
      }
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return {
    budget,
    rankedBudget,
    result,
    status,
    fixes,
    candidates,
    setBudget: (value) => {
      const next = snapBudget(value);
      setBudgetState(next);
      latest.current.budget = next;
      if (timer.current) clearTimeout(timer.current);
      sequence.current++;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("offline");
        return;
      }
      setStatus("loading");
      timer.current = setTimeout(() => void submit(next), RANK_DEBOUNCE_MS);
    },
    retry: () => void submit(latest.current.budget),
  };
}
