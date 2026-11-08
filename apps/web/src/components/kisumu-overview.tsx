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
import { FundingTrace } from "./funding-trace";
import { SHOCK_STEPS, useTour } from "../tour/tour";
import { withDisplayNames } from "../kisumu/names";
import { runEvents } from "../kisumu/view";
import { KisumuVerdict } from "./kisumu-verdict";
import { TabList, type TabItem } from "./tabs";

type View = "overview" | "order" | "funding" | "facilities";
import {
  ScenarioControls,
  type Compare,
  type Shock,
} from "./scenario-controls";

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
/** Facilities short regardless of the shock: opening gaps or stockouts that occur with no shock. */
function preShockFacilities(run: ScenarioRun | null): ReadonlySet<string> {
  const rows = [
    run?.result?.pre_shock_stockouts,
    run?.result?.baseline_stockouts,
  ].flatMap((value) => (validEvents(value) ? value : []));
  return new Set(rows.map((row) => row.facility_id));
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
  panel: generated,
  scenario,
  canRun = true,
  rank,
  trace,
}: {
  panel: PilotPanel;
  scenario: ScenarioApi;
  canRun?: boolean;
  rank?: (
    runId: string,
    body: components["schemas"]["ModeledRequest"],
  ) => Promise<components["schemas"]["ModeledResponse"]>;
  trace?: (
    flowId: string,
    asOf: string,
  ) => Promise<components["schemas"]["FundingTraceResponse"]>;
}) {
  const { t, tf } = usePreferences();
  // Invented display names replace the generator's numbered names everywhere on this page.
  const panel = useMemo(() => withDisplayNames(generated), [generated]);
  const [shock, setShock] = useState<Shock>(40);
  const [compare, setCompare] = useState<Compare>("shock");
  const [controlsOpen, setControlsOpen] = useState(false);
  const { magnitude, setMagnitude, run, status, previous, runMagnitude } =
    useKisumuScenario(scenario, canRun, 40);
  const choose = (next: Shock, view: Compare) => {
    setShock(next);
    setCompare(view);
    setMagnitude(view === "none" ? 0 : next);
  };
  const { step } = useTour();
  useEffect(() => {
    // The guided demo shows the 40% shock; the user can still pick another.
    if (canRun && step && SHOCK_STEPS.includes(step)) choose(40, "shock");
  }, [step, canRun]);
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
  const preShock = useMemo(() => preShockFacilities(run), [run]);
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
  const events = useMemo(() => runEvents(run?.result), [run]);
  const counts = useMemo(() => {
    if (!run || !events) return null;
    const values = Object.values(risks);
    const count = (status: string) =>
      values.filter((item) => item.status === status).length;
    return {
      critical: count("critical"),
      watch: count("watch"),
      stable: count("stable"),
    };
  }, [risks, run, events]);
  // Older snapshots have one planted transfer; test panels may have none.
  const cases = panel.demo_cases as
    Partial<PilotPanel["demo_cases"]> | undefined;
  const routes =
    cases?.transfer_routes ??
    (cases?.near_expiry_transfer ? [cases.near_expiry_transfer] : []);
  const reveal = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView?.({ block: "start" });
    if (!element.hasAttribute("tabindex"))
      element.setAttribute("tabindex", "-1");
    element.focus({ preventScroll: true });
  };
  const [tab, setTab] = useState<View>("overview");
  useEffect(() => {
    // The navigation's funding link lands on this page with #funding-title.
    if (window.location.hash === "#funding-title") setTab("funding");
  }, []);
  useEffect(() => {
    // The guided demo opens the tab that holds each step's target.
    if (step === "funding") setTab("funding");
    else if (step === "rank") setTab("overview");
  }, [step]);
  const show = (view: View, id: string) => {
    setTab(view);
    // The panel renders on the next frame; then move focus to the target.
    requestAnimationFrame(() => reveal(id));
  };
  const views: TabItem<View>[] = [
    { id: "overview", label: t("tabOverview") },
    ...(canRun
      ? [
          {
            id: "order" as const,
            label: t("tabOrder"),
            count: events && !pending ? events.shock.length : undefined,
          },
          { id: "funding" as const, label: t("tabFunding") },
        ]
      : []),
    {
      id: "facilities",
      label: t("tabFacilities"),
      count: panel.facilities.length,
    },
  ];
  const mapProps = {
    facilities,
    risks,
    onSelect: (id: string) => {
      setSelected(id);
      setTab("facilities");
    },
    preShock,
    magnitude: run && !previous ? magnitude : undefined,
  };
  const mapSection = (
    <section className="panel" aria-label={t("facilityMapTitle")}>
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
        {/* One map at a time: the sheet's copy replaces this hidden one. */}
        {!mapOpen && <FacilityMap {...mapProps} onSelect={setSelected} />}
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
        {mapOpen && <FacilityMap {...mapProps} onSelect={setSelected} />}
        <div className="map-drawer" aria-live="polite">
          {facility ? `${facility.name} · ${facility.id}` : t("selectFacility")}
        </div>
      </dialog>
    </section>
  );
  return (
    <>
      <p className="crumbs">
        <a href="/">Kenya</a> / Kisumu
      </p>
      <div className="head-row">
        <h1>{t("kisumuTitle")}</h1>
        {canRun && (
          <span className="scenario">
            {magnitude === 0
              ? t("scenarioNone")
              : tf("scenarioCut", { n: magnitude })}
          </span>
        )}
      </div>
      {canRun && (
        <KisumuVerdict
          panel={panel}
          routes={routes}
          magnitude={runMagnitude}
          events={events}
          counts={counts}
          busy={pending && status !== "error"}
          onShowOrder={() => show("order", "stockout-order")}
          onShowFacility={(id) => {
            setSelected(id);
            show("facilities", "facility-detail");
          }}
        />
      )}
      {canRun && (
        <button
          type="button"
          className="btn change-scenario"
          aria-expanded={controlsOpen}
          aria-controls="scenario-controls"
          onClick={() => setControlsOpen(!controlsOpen)}
        >
          {controlsOpen ? t("hideScenario") : t("changeScenario")}
          <span className="change-scenario-current">
            {magnitude === 0
              ? t("scenarioNone")
              : tf("scenarioCut", { n: magnitude })}
          </span>
        </button>
      )}
      <div className="layout">
        {canRun && (
          <ScenarioControls
            shock={shock}
            compare={compare}
            enabled={canRun}
            open={controlsOpen}
            status={
              status === "error"
                ? t("scenarioError")
                : pending
                  ? tf("verdictLoading", { n: magnitude })
                  : undefined
            }
            onShock={(value) => choose(value, "shock")}
            onCompare={(view) => choose(shock, view)}
          />
        )}
        <div className="results">
          <TabList
            label={t("tabsLabel")}
            items={views}
            selected={tab}
            onSelect={setTab}
          />
          <div
            role="tabpanel"
            id="p-overview"
            aria-labelledby="t-overview"
            tabIndex={0}
            hidden={tab !== "overview"}
          >
            <div className="overview">
              {mapSection}
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
                    events={shockEvents}
                    routes={routes}
                    rank={(body) => rank(run.id, body)}
                  />
                )}
            </div>
          </div>
          {canRun && (
            <div
              role="tabpanel"
              id="p-order"
              aria-labelledby="t-order"
              tabIndex={0}
              hidden={tab !== "order"}
            >
              <section className="panel" aria-labelledby="stockout-order">
                {events && !pending ? (
                  <StockoutOrder
                    panel={panel}
                    magnitude={magnitude}
                    total={events.all.length}
                    shock={events.shock}
                    alreadyShort={events.alreadyShort}
                  />
                ) : (
                  <>
                    <h2 id="stockout-order" tabIndex={-1}>
                      {t("orderTitle")}
                    </h2>
                    <p className="state" role="status">
                      {status === "error"
                        ? t("scenarioError")
                        : run && !events
                          ? t("verdictUnavailable")
                          : tf("verdictLoading", { n: magnitude })}
                    </p>
                  </>
                )}
              </section>
            </div>
          )}
          {canRun && (
            <div
              role="tabpanel"
              id="p-funding"
              aria-labelledby="t-funding"
              tabIndex={0}
              hidden={tab !== "funding"}
            >
              {trace && (
                <FundingTrace
                  flow={panel.demo_cases.stalled_release}
                  trace={trace}
                />
              )}
            </div>
          )}
          <div
            role="tabpanel"
            id="p-facilities"
            aria-labelledby="t-facilities"
            tabIndex={0}
            hidden={tab !== "facilities"}
          >
            <section className="panel" aria-labelledby="facilities-heading">
              <h2 id="facilities-heading">{t("facilities")}</h2>
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
            <section className="panel" id="facility-detail" aria-live="polite">
              {facility && risk ? (
                <>
                  <h2>
                    {facility.name} · {facility.id}
                  </h2>
                  <p>
                    {t(risk.status)}
                    {preShock.has(facility.id) &&
                      ` · ${t("alreadyShort")}`} · {t("drivers")}:{" "}
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
          </div>
        </div>
      </div>
    </>
  );
}
