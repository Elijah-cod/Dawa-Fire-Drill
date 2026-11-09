import { useState } from "react";
import type { PilotPanel } from "../api/client";
import type { ShockEvent } from "../api/candidates";
import { commodityLabel } from "../kisumu/names";
import { usePreferences } from "../preferences/preferences";

/** How many shock-caused stockouts show before "Show all". */
export const ORDER_PREVIEW = 10;

/**
 * Every stockout in the shown run, in order: the ones already short before the shock apart
 * from the ones the backend attributes to the shock.
 */
export function StockoutOrder({
  panel,
  magnitude,
  total,
  shock,
  alreadyShort,
}: {
  panel: PilotPanel;
  magnitude: number;
  total: number;
  shock: ShockEvent[];
  alreadyShort: ShockEvent[];
}) {
  const { t, tf, locale } = usePreferences();
  const facility = (id: string) => panel.facilities.find((f) => f.id === id);
  const place = (id: string) =>
    tf("verdictPlace", {
      name: facility(id)?.name ?? id,
      area:
        panel.subcounties.find((s) => s.id === facility(id)?.subcounty_id)
          ?.name ?? "",
    });
  const medicine = (id: string) =>
    commodityLabel(panel.commodities, id, locale).toLocaleLowerCase(locale);
  // Filters by area and medicine apply to both groups; counts follow the filters.
  const [area, setArea] = useState("all");
  const [commodity, setCommodity] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const keep = (event: ShockEvent) =>
    (area === "all" || facility(event.facility_id)?.subcounty_id === area) &&
    (commodity === "all" || event.commodity_id === commodity);
  const short = alreadyShort.filter(keep);
  const caused = shock.filter(keep);
  const filtered = area !== "all" || commodity !== "all";
  const item = (event: ShockEvent, key: "orderDay" | "orderFromDay") => (
    <li key={`${event.facility_id}-${event.commodity_id}-${event.day}`}>
      {place(event.facility_id)} · {medicine(event.commodity_id)} ·{" "}
      {tf(key, { day: event.day })}
    </li>
  );
  return (
    <>
      <h2 id="stockout-order" tabIndex={-1}>
        {t("orderTitle")}
      </h2>
      <p className="sub">
        {tf("orderSummary", {
          scenario:
            magnitude === 0
              ? t("scenarioNone")
              : tf("scenarioCut", { n: magnitude }),
          total,
        })}
      </p>
      <fieldset className="filters">
        <legend>{t("orderFilterLegend")}</legend>
        <div className="filter-row">
          <div>
            <label className="field-label" htmlFor="order-area">
              {t("subcounty")}
            </label>
            <select
              id="order-area"
              value={area}
              onChange={(event) => setArea(event.target.value)}
            >
              <option value="all">{t("allSubcounties")}</option>
              {panel.subcounties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="order-commodity">
              {t("filterCommodity")}
            </label>
            <select
              id="order-commodity"
              value={commodity}
              onChange={(event) => setCommodity(event.target.value)}
            >
              <option value="all">{t("allCommodities")}</option>
              {panel.commodities.map((item) => (
                <option key={item.id} value={item.id}>
                  {commodityLabel(panel.commodities, item.id, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filtered && (
          <p className="filter-count" role="status">
            {tf("orderFilteredCount", {
              n: short.length + caused.length,
              total: alreadyShort.length + shock.length,
            })}
          </p>
        )}
      </fieldset>
      <h3 className="group-title">
        {tf("orderAlreadyShort", { n: short.length })}
      </h3>
      {short.length ? (
        <ol className="order">
          {short.map((event) => item(event, "orderFromDay"))}
        </ol>
      ) : (
        <p className="state">
          {filtered ? t("orderNoneFiltered") : t("orderNoneShort")}
        </p>
      )}
      <h3 className="group-title">{tf("orderCaused", { n: caused.length })}</h3>
      {caused.length ? (
        <>
          {/* Where the reader is in the list: "Showing 1–10 of 209", or all of it. */}
          <p className="order-position" aria-live="polite">
            {caused.length <= ORDER_PREVIEW || expanded
              ? tf("orderShowingAll", { total: caused.length })
              : tf("orderShowing", {
                  from: 1,
                  to: ORDER_PREVIEW,
                  total: caused.length,
                })}
          </p>
          <ol className="order">
            {caused
              .slice(0, ORDER_PREVIEW)
              .map((event) => item(event, "orderDay"))}
          </ol>
          {caused.length > ORDER_PREVIEW && (
            <details
              className="order-more"
              onToggle={(event) => setExpanded(event.currentTarget.open)}
            >
              <summary className="btn">
                {expanded
                  ? tf("orderShowFewer", { n: ORDER_PREVIEW })
                  : tf("orderShowAll", {
                      n: caused.length,
                      from: ORDER_PREVIEW + 1,
                      to: caused.length,
                    })}
              </summary>
              <ol className="order" start={ORDER_PREVIEW + 1}>
                {caused
                  .slice(ORDER_PREVIEW)
                  .map((event) => item(event, "orderDay"))}
              </ol>
            </details>
          )}
        </>
      ) : (
        <p className="state">
          {filtered ? t("orderNoneFiltered") : t("orderNoneCaused")}
        </p>
      )}
    </>
  );
}
