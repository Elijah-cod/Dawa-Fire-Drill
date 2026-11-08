"use client";

import { useEffect, useState } from "react";

export type ScenarioRun = {
  id: string;
  status: string;
  result: Record<string, unknown> | null;
  horizon_days: number;
};
export type ScenarioApi = {
  submit: (magnitude: number, key: string) => Promise<ScenarioRun>;
  read: (id: string) => Promise<ScenarioRun>;
};

/** Run the initial shock first; keep the previous result visibly distinct while rerunning. */
export function useKisumuScenario(
  api: ScenarioApi,
  enabled = true,
  initial = 0,
) {
  const [magnitude, setMagnitude] = useState(initial);
  const [run, setRun] = useState<ScenarioRun | null>(null);
  const [runMagnitude, setRunMagnitude] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "ready" | "error">(
    enabled ? "running" : "idle",
  );
  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    let active = true;
    setStatus("running");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          let current = await api.submit(magnitude, crypto.randomUUID());
          for (
            let attempt = 0;
            active &&
            ["queued", "running"].includes(current.status) &&
            attempt < 120;
            attempt++
          ) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (active) current = await api.read(current.id);
          }
          if (!active) return;
          if (current.status !== "succeeded" || !current.result)
            throw new Error("Run unavailable");
          setRun(current);
          setRunMagnitude(magnitude);
          setStatus("ready");
        } catch {
          if (active) setStatus("error");
        }
      })();
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, magnitude, enabled]);
  return {
    magnitude,
    setMagnitude,
    run: enabled ? run : null,
    status,
    previous: enabled && run !== null && runMagnitude !== magnitude,
    /** The shock of the run on screen, which trails magnitude while a run is in flight. */
    runMagnitude: enabled ? runMagnitude : null,
  };
}
