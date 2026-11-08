"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PilotPanel } from "../api/client";
import type { components } from "../generated/api";
import { usePreferences } from "../preferences/preferences";

type Trace = components["schemas"]["FundingTraceResponse"];
type Bottleneck = components["schemas"]["BottleneckRead"];
type Flow = PilotPanel["demo_cases"]["stalled_release"];

const stageKeys = {
  approved_not_released: "approved_not_released",
  released_not_procured: "released_not_procured",
  procured_not_delivered: "procured_not_delivered",
} as const;

/** Synthetic funding stages and the backend's ageing of delayed amounts. */
export function FundingTrace({
  flow,
  trace,
}: {
  flow: Flow;
  trace: (flowId: string, asOf: string) => Promise<Trace>;
}) {
  const { t } = usePreferences();
  const [result, setResult] = useState<Trace | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "idle">("loading");
  const [online, setOnline] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setStatus("loading");
    try {
      const response = await trace(flow.id, flow.as_of);
      if (request !== sequence.current) return;
      if (response.synthetic !== true) throw new Error("Not synthetic");
      setResult(response);
      setStatus("idle");
    } catch {
      if (request === sequence.current) setStatus("error");
    }
  }, [trace, flow.id, flow.as_of]);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    if (navigator.onLine) void load();
    else setStatus("idle");
    return () => {
      sequence.current++;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [load]);
  const label = (stage: string) =>
    stage in stageKeys
      ? t(stageKeys[stage as keyof typeof stageKeys])
      : t("fundingStageUnknown");
  const amount = (value: number) => `${value.toLocaleString("en-KE")} KES`;
  const bottlenecks = [...(result?.bottlenecks ?? [])].sort(
    (a, b) => b.age_days - a.age_days,
  );
  const chosen: Bottleneck | undefined = bottlenecks.find(
    (item) => item.stage === selected,
  );
  return (
    <section className="panel" aria-labelledby="funding-title">
      <h2 id="funding-title">{t("fundingTitle")}</h2>
      <p>{t("fundingNote")}</p>
      <p>
        {flow.id} · {t("fundingAsOf")} {flow.as_of}
      </p>
      <h3>{t("fundingStages")}</h3>
      <ol className="funding-stages">
        <li>
          {t("stageApproved")} · {amount(flow.approved)}
        </li>
        <li>
          {t("stageReleased")} · {amount(flow.released)}
        </li>
        <li>
          {t("stageProcured")} · {amount(0)}
        </li>
        <li>
          {t("stageDelivered")} · {amount(0)}
        </li>
      </ol>
      {!online && <p role="status">{t("fundingOffline")}</p>}
      {status === "loading" && <p role="status">{t("fundingLoading")}</p>}
      {status === "error" && (
        <p role="alert">
          {t("fundingError")}{" "}
          <button
            className="rank-action"
            type="button"
            disabled={!online}
            onClick={() => void load()}
          >
            {t("fundingRetry")}
          </button>
        </p>
      )}
      {result && (
        <>
          <h3>{t("fundingAgeing")}</h3>
          {bottlenecks.length === 0 ? (
            <p>{t("fundingEmpty")}</p>
          ) : (
            <ul className="funding-ageing">
              {bottlenecks.map((item) => (
                <li key={item.stage}>
                  {label(item.stage)} · {amount(item.amount)} · {item.age_days}{" "}
                  {t("fundingAge")}{" "}
                  <button
                    className="rank-action"
                    type="button"
                    aria-pressed={selected === item.stage}
                    aria-label={`${t("fundingInspect")}: ${label(item.stage)}`}
                    onClick={() => setSelected(item.stage)}
                  >
                    {t("fundingInspect")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div aria-live="polite">
            {chosen && (
              <dl className="funding-detail">
                <dt>{t("fundingDetail")}</dt>
                <dd>
                  {label(chosen.stage)} · {amount(chosen.amount)}
                </dd>
                <dt>{t("fundingApprovedOn")}</dt>
                <dd>{flow.approved_on}</dd>
                <dt>{t("fundingAge")}</dt>
                <dd>
                  {chosen.age_days} · {t("fundingAsOf")} {flow.as_of}
                </dd>
              </dl>
            )}
          </div>
        </>
      )}
    </section>
  );
}
