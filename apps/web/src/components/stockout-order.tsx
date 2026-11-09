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
      <h3 className="group-title">
        {tf("orderAlreadyShort", { n: alreadyShort.length })}
      </h3>
      {alreadyShort.length ? (
        <ol className="order">
          {alreadyShort.map((event) => item(event, "orderFromDay"))}
        </ol>
      ) : (
        <p className="state">{t("orderNoneShort")}</p>
      )}
      <h3 className="group-title">{tf("orderCaused", { n: shock.length })}</h3>
      {shock.length ? (
        <>
          <ol className="order">
            {shock
              .slice(0, ORDER_PREVIEW)
              .map((event) => item(event, "orderDay"))}
          </ol>
          {shock.length > ORDER_PREVIEW && (
            <details className="order-more">
              <summary className="btn">
                {tf("orderShowAll", { n: shock.length })}
              </summary>
              <ol className="order" start={ORDER_PREVIEW + 1}>
                {shock
                  .slice(ORDER_PREVIEW)
                  .map((event) => item(event, "orderDay"))}
              </ol>
            </details>
          )}
        </>
      ) : (
        <p className="state">{t("orderNoneCaused")}</p>
      )}
    </>
  );
}
