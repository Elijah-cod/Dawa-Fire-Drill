"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PilotPanel } from "../api/client";
import { usePreferences } from "../preferences/preferences";
import { risksForRun } from "../risk/risk";
import {
  useKisumuScenario,
  type ScenarioApi,
  type ScenarioRun,
} from "../scenario/use-kisumu-scenario";
import { FacilityMap } from "./facility-map";
import { StockoutOrder } from "./stockout-order";
import type { components } from "../generated/api";

/** Same footprint as the loaded panel so arriving results do not shift the page. */
function RankPlaceholder({ message }: { message?: string }) {
  const { t } = usePreferences();
  return (
    <section className="panel rank-panel rank-placeholder" aria-busy="true">
      <h2>{t("doThisFirst")}</h2>
      <p role="status">{message ?? t("rankLoading")}</p>
    </section>
  );
}
function RankLoading() {
  return <RankPlaceholder />;
}
const RankedFixes = dynamic(
  () => import("./ranked-fixes").then((module) => module.RankedFixes),
  { ssr: false, loading: RankLoading },
);

type Event = { facility_id: string; commodity_id: string; day: number };
function validEvents(value: unknown): value is Event[] {
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
function evidence(run: ScenarioRun | null) {
  if (
    !run?.result ||
    run.result.synthetic !== true ||
    run.result.county_code !== "042" ||
    !validEvents(run.result.stockouts)
  )
    return null;
  return { horizon_days: run.horizon_days, stockouts: run.result.stockouts };
}

export function KisumuOverview({
  panel,
  scenario,
  canRun = true,
  rank,
}: {
  panel: PilotPanel;
  scenario: ScenarioApi;
  canRun?: boolean;
  rank?: (
    runId: string,
    body: components["schemas"]["ModeledRequest"],
  ) => Promise<components["schemas"]["ModeledResponse"]>;
}) {
  const { t } = usePreferences();
  const { magnitude, setMagnitude, run, status, previous } = useKisumuScenario(
    scenario,
    canRun,
  );
  const [subcounty, setSubcounty] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [mapOpen, setMapOpen] = useState(false);
  useEffect(() => {
    if (!mapOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mapOpen]);
  const risks = useMemo(() => risksForRun(panel, evidence(run)), [panel, run]);
  const facilities = useMemo(
    () =>
      panel.facilities.filter(
        (item) => subcounty === "all" || item.subcounty_id === subcounty,
      ),
    [panel, subcounty],
  );
  const facility = panel.facilities.find((item) => item.id === selected);
  const risk = selected ? risks[selected] : undefined;
  const shockEvents = run?.result?.shock_caused_stockouts;
  const pending = !run || previous;
  const facilitySection = useMemo(
    () => (
      <section className="panel">
        <label htmlFor="subcounty-filter">{t("subcounty")}</label>
        <select
          id="subcounty-filter"
          value={subcounty}
          onChange={(event) => setSubcounty(event.target.value)}
        >
          <option value="all">{t("allSubcounties")}</option>
          {panel.subcounties.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          className="mobile-map-toggle"
          type="button"
          onClick={() => {
            dialog.current?.showModal();
            setMapOpen(true);
          }}
        >
          {t("openFacilityMap")}
        </button>
        <div className="desktop-grid">
          <FacilityMap
            facilities={facilities}
            risks={risks}
            onSelect={setSelected}
          />
        </div>
        <dialog
          ref={dialog}
          className="map-sheet"
          aria-label={t("facilityMapTitle")}
          onClose={() => setMapOpen(false)}
        >
          <div className="map-sheet-header">
            <h2>{t("facilityMapTitle")}</h2>
            <button type="button" onClick={() => dialog.current?.close()}>
              {t("closeMap")}
            </button>
          </div>
          {mapOpen && (
            <FacilityMap
              facilities={facilities}
              risks={risks}
              onSelect={setSelected}
            />
          )}
          <div className="map-drawer" aria-live="polite">
            {facility
              ? `${facility.name} · ${facility.id}`
              : t("selectFacility")}
          </div>
        </dialog>
        <h2>{t("facilities")}</h2>
        <ul className="county-list">
          {facilities.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setSelected(item.id)}>
                {item.name} · {item.id}
              </button>
            </li>
          ))}
        </ul>
      </section>
    ),
    [facilities, risks, subcounty, panel.subcounties, mapOpen, facility, t],
  );
  return (
    <>
      <p>
        <a className="underline" href="/">
          Kenya
        </a>{" "}
        / Kisumu
      </p>
      <h1>{t("kisumuTitle")}</h1>
      <p>{t("syntheticNote")}</p>
      <section className="panel">
        <label htmlFor="shock-slider">
          {t("shockLabel")}: {magnitude}%
        </label>
        <input
          id="shock-slider"
          type="range"
          disabled={!canRun}
          min="0"
          max="100"
          value={magnitude}
          onChange={(event) => setMagnitude(Number(event.target.value))}
        />
        {magnitude === 0 && <p>{t("baseline")}</p>}
        <p className="scenario-status" role="status" aria-live="polite">
          {status === "running"
            ? t("scenarioRunning")
            : status === "error"
              ? t("scenarioError")
              : previous
                ? t("previousRun")
                : ""}
        </p>
        {previous && <p>{t("previousRun")}</p>}
      </section>
      {magnitude > 0 && (
        <section className="panel shock-panel" aria-busy={pending}>
          <h2>{t("shockFirst")}</h2>
          {pending ? (
            <p>
              {status === "error" ? t("scenarioError") : t("scenarioRunning")}
            </p>
          ) : !validEvents(shockEvents) ? (
            <p>{t("shockDetailsUnavailable")}</p>
          ) : shockEvents.length ? (
            <StockoutOrder events={shockEvents} />
          ) : (
            <p>{t("noShockStockouts")}</p>
          )}
        </section>
      )}
      {canRun && rank && magnitude > 0 && pending && (
        <RankPlaceholder
          message={status === "error" ? t("scenarioError") : undefined}
        />
      )}
      {run &&
        canRun &&
        rank &&
        magnitude > 0 &&
        !pending &&
        validEvents(shockEvents) &&
        shockEvents.length > 0 && (
          <RankedFixes
            key={run.id}
            runId={run.id}
            target={shockEvents[0]}
            transfer={panel.demo_cases.near_expiry_transfer}
            rank={(body) => rank(run.id, body)}
          />
        )}
      {facilitySection}
      <section className="panel" aria-live="polite">
        {facility && risk ? (
          <>
            <h2>
              {facility.name} · {facility.id}
            </h2>
            <p>
              {t(risk.status)} · {t("drivers")}:{" "}
              {risk.drivers.join(", ") || "—"} ·{" "}
              {risk.days === null
                ? risk.status === "unknown"
                  ? t("noRiskData")
                  : t("noStockout")
                : `${risk.days} ${t("days")}`}
            </p>
          </>
        ) : (
          <p>{t("selectFacility")}</p>
        )}
      </section>
    </>
  );
}
