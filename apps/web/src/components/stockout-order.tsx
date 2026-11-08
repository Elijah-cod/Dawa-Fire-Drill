import { useState } from "react";
import { usePreferences } from "../preferences/preferences";

type Event = { facility_id: string; commodity_id: string; day: number };

/** The 7-day window (from day 1) with the most events; the earliest wins a tie. */
export function peakWindow(events: Event[]) {
  const counts = new Map<number, number>();
  for (const event of events) {
    const index = Math.floor((event.day - 1) / 7);
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  let best: [number, number] | null = null;
  for (const [index, count] of [...counts].sort((a, b) => a[0] - b[0]))
    if (!best || count > best[1]) best = [index, count];
  return (
    best && { start: best[0] * 7 + 1, end: best[0] * 7 + 7, count: best[1] }
  );
}

export function StockoutOrder({
  events,
  magnitude,
  total,
  noShock,
}: {
  events: Event[];
  magnitude: number;
  total?: number;
  noShock?: number;
}) {
  const { t } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const first = events[0];
  const peak = peakWindow(events);
  return (
    <>
      <p className="stockout-summary" role="status">
        {magnitude}% {t("summaryShock")}:{" "}
        {total !== undefined && noShock !== undefined && (
          <>
            {total} {t("summaryStockouts")} {t("summaryVs")} {noShock}{" "}
            {t("summaryNoShock")} ·{" "}
          </>
        )}
        {events.length} {t("summaryCaused")}.
        {first && (
          <>
            {" "}
            {t("summaryFirst")}: {first.facility_id} · {first.commodity_id}{" "}
            {t("summaryOnDay")} {first.day}.
          </>
        )}
        {peak && (
          <>
            {" "}
            {t("summaryMost")}: {t("summaryDays")} {peak.start}–{peak.end} (
            {peak.count}).
          </>
        )}
      </p>
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>
          {t("showAllPrefix")} {events.length} {t("showAllSuffix")}
        </summary>
        {expanded && (
          <ol>
            {events.map((event) => (
              <li key={`${event.facility_id}-${event.commodity_id}`}>
                {event.facility_id} · {event.commodity_id} · {event.day}{" "}
                {t("days")}
              </li>
            ))}
          </ol>
        )}
      </details>
    </>
  );
}
