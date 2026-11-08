import { useState } from "react";
import { usePreferences } from "../preferences/preferences";

type Event = { facility_id: string; commodity_id: string; day: number };
export function StockoutOrder({ events }: { events: Event[] }) {
  const { t } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const rows = (items: Event[]) =>
    items.map((event) => (
      <li key={`${event.facility_id}-${event.commodity_id}`}>
        {event.facility_id} · {event.commodity_id} · {event.day} {t("days")}
      </li>
    ));
  const first = events[0];
  const sameDay = first
    ? events.filter(
        (event) =>
          event !== first &&
          event.facility_id === first.facility_id &&
          event.day === first.day,
      )
    : [];
  return (
    <>
      {sameDay.length > 0 && (
        <p className="same-day-note">
          {t("sameDayAlso")} {first.facility_id} · {first.day} {t("days")}:{" "}
          {sameDay.map((event) => event.commodity_id).join(", ")}
        </p>
      )}
      <ol>{rows(events.slice(0, 5))}</ol>
      {events.length > 5 && (
        <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
          <summary>
            {t("showRemainingPrefix")} {events.length - 5}{" "}
            {t("showRemainingSuffix")}
          </summary>
          {expanded && <ol start={6}>{rows(events.slice(5))}</ol>}
        </details>
      )}
    </>
  );
}
