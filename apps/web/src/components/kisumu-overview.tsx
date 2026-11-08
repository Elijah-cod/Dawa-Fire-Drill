"use client";

import { useMemo, useState } from "react";
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
import { RankedFixes } from "./ranked-fixes";
import type { components } from "../generated/api";

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
        <p role="status" aria-live="polite">
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
      {run && magnitude > 0 && !previous && (
        <section className="panel">
          <h2>{t("shockFirst")}</h2>
          {!validEvents(shockEvents) ? (
            <p>{t("shockDetailsUnavailable")}</p>
          ) : shockEvents.length ? (
            <StockoutOrder events={shockEvents} />
          ) : (
            <p>{t("noShockStockouts")}</p>
          )}
        </section>
      )}
      {run &&
        canRun &&
        rank &&
        magnitude > 0 &&
        !previous &&
        validEvents(shockEvents) &&
        shockEvents.length > 0 && (
          <RankedFixes
            key={run.id}
            runId={run.id}
            target={shockEvents[0]}
            rank={(body) => rank(run.id, body)}
          />
        )}
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
        <FacilityMap
          facilities={facilities}
          risks={risks}
          onSelect={setSelected}
        />
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
