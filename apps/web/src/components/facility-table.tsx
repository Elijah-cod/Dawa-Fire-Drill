"use client";

import { useState } from "react";
import type { PilotPanel } from "../api/client";
import type { PlantedRoute, ShockEvent } from "../api/candidates";
import { commodityLabel } from "../kisumu/names";
import { RISK_PRIORITY, type FacilityRisk, type Risk } from "../risk/risk";
import { usePreferences } from "../preferences/preferences";

/** Drawn status symbols from the approved preview: status never relies on colour alone. */
const SYMBOLS: Record<Risk, React.ReactNode> = {
  critical: (
    <>
      <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" />
      <path d="M12 8v5M12 16.5v.5" />
    </>
  ),
  watch: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
  stable: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  unknown: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17v.5" />
    </>
  ),
};

export function StatusChip({ status }: { status: Risk }) {
  const { t } = usePreferences();
  return (
    <span className={`status status--${status}`}>
      <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
        {SYMBOLS[status]}
      </svg>
      {t(status)}
    </span>
  );
}

type Sort = "name" | "area" | "status" | "day";

/**
 * All facilities with status from the shown run, sortable, each row selecting the detail
 * panel. The table scrolls sideways inside its own focusable region on narrow screens.
 */
export function FacilityTable({
  panel,
  facilities,
  risks,
  events,
  selected,
  onSelect,
}: {
  panel: PilotPanel;
  facilities: PilotPanel["facilities"];
  risks: Record<string, FacilityRisk>;
  events: ShockEvent[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { t, locale } = usePreferences();
  const [sort, setSort] = useState<{ key: Sort; up: boolean }>({
    key: "status",
    up: false,
  });
  const area = (facility: PilotPanel["facilities"][number]) =>
    panel.subcounties.find((s) => s.id === facility.subcounty_id)?.name ?? "";
  const first = (id: string) =>
    events
      .filter((event) => event.facility_id === id)
      .sort((a, b) => a.day - b.day)[0];
  const rows = facilities.map((facility) => ({
    facility,
    area: area(facility),
    status: risks[facility.id]?.status ?? "unknown",
    first: first(facility.id),
  }));
  const value = (row: (typeof rows)[number]): string | number =>
    sort.key === "name"
      ? row.facility.name
      : sort.key === "area"
        ? row.area
        : sort.key === "status"
          ? RISK_PRIORITY[row.status]
          : (row.first?.day ?? Number.POSITIVE_INFINITY);
  rows.sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const order =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y));
    return (
      (sort.up ? order : -order) || a.facility.id.localeCompare(b.facility.id)
    );
  });
  const header = (key: Sort, label: string) => (
    <th
      scope="col"
      aria-sort={
        sort.key === key ? (sort.up ? "ascending" : "descending") : undefined
      }
    >
      <button
        type="button"
        onClick={() =>
          setSort({ key, up: sort.key === key ? !sort.up : key !== "status" })
        }
      >
        {label}
        <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        </svg>
      </button>
    </th>
  );
  return (
    <>
      <p className="sub" id="table-cutoffs">
        {t("tableCaption")}
      </p>
      <div
        className="table-wrap"
        role="region"
        aria-label={t("tableLabel")}
        tabIndex={0}
      >
        <table aria-describedby="table-cutoffs">
          <caption className="visually-hidden">{t("tableLabel")}</caption>
          <thead>
            <tr>
              {header("name", t("colFacility"))}
              {header("area", t("colArea"))}
              {header("status", t("colStatus"))}
              {header("day", t("colFirst"))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.facility.id}
                aria-selected={row.facility.id === selected}
                onClick={() => onSelect(row.facility.id)}
              >
                <td>
                  <button
                    type="button"
                    className="row-select"
                    aria-current={row.facility.id === selected || undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(row.facility.id);
                    }}
                  >
                    {row.facility.name}
                  </button>
                </td>
                <td>{row.area}</td>
                <td>
                  <StatusChip status={row.status} />
                </td>
                <td>
                  {row.first
                    ? `${row.first.day} · ${commodityLabel(panel.commodities, row.first.commodity_id, locale).toLocaleLowerCase(locale)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** One facility from the shown run: status, every stockout, and any planted transfer. */
export function FacilityDetail({
  panel,
  facility,
  risk,
  events,
  alreadyShort,
  routes,
}: {
  panel: PilotPanel;
  facility: PilotPanel["facilities"][number] | undefined;
  risk: FacilityRisk | undefined;
  events: ShockEvent[];
  alreadyShort: boolean;
  routes: PlantedRoute[];
}) {
  const { t, tf, locale } = usePreferences();
  if (!facility || !risk) return <p>{t("selectFacility")}</p>;
  const name = (id: string) =>
    panel.facilities.find((item) => item.id === id)?.name ?? id;
  const medicine = (id: string) =>
    commodityLabel(panel.commodities, id, locale);
  const own = events
    .filter((event) => event.facility_id === facility.id)
    .sort((a, b) => a.day - b.day);
  const incoming = routes.filter((route) => route.facility_id === facility.id);
  const outgoing = routes.filter(
    (route) => route.donor_facility_id === facility.id,
  );
  return (
    <>
      <h2>
        {facility.name} · {facility.id}
      </h2>
      <dl className="detail-list">
        <dt>{t("colArea")}</dt>
        <dd>
          {panel.subcounties.find((s) => s.id === facility.subcounty_id)?.name}
        </dd>
        <dt>{t("detailLevel")}</dt>
        <dd>{tf("detailLevelValue", { n: facility.level })}</dd>
        <dt>{t("colStatus")}</dt>
        <dd>
          <StatusChip status={risk.status} />
          {alreadyShort && ` · ${t("alreadyShort")}`}
        </dd>
        <dt>{t("drivers")}</dt>
        <dd>
          {risk.drivers.map((id) => medicine(id)).join(", ") || "—"} ·{" "}
          {risk.days === null
            ? risk.status === "unknown"
              ? t("noRiskData")
              : t("noStockout")
            : risk.days === 0
              ? t("outAtStart")
              : tf("runsOutOnDay", { day: risk.days })}
        </dd>
      </dl>
      <h3 className="group-title">
        {tf("detailStockouts", { n: own.length })}
      </h3>
      {own.length ? (
        <ul className="order detail-stockouts">
          {own.map((event) => (
            <li key={event.commodity_id}>
              {tf("detailStockout", {
                medicine: medicine(event.commodity_id),
                day: event.day,
              })}
            </li>
          ))}
        </ul>
      ) : (
        <p className="state">{t("noStockout")}</p>
      )}
      {incoming.map((route) => (
        <p className="detail-route" key={`in-${route.commodity_id}`}>
          {tf("detailIncoming", {
            medicine: medicine(route.commodity_id).toLocaleLowerCase(locale),
            donor: name(route.donor_facility_id),
            km: route.distance_km,
            day: route.arrival_day,
          })}
        </p>
      ))}
      {outgoing.map((route) => (
        <p className="detail-route" key={`out-${route.facility_id}`}>
          {tf("detailOutgoing", {
            medicine: medicine(route.commodity_id).toLocaleLowerCase(locale),
            recipient: name(route.facility_id),
          })}
        </p>
      ))}
    </>
  );
}
