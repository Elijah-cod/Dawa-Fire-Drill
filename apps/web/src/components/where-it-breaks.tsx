"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PilotPanel } from "../api/client";
import type { ShockEvent } from "../api/candidates";
import type { FacilityRisk } from "../risk/risk";
import { usePreferences } from "../preferences/preferences";

export const HORIZON = 90;
export const DEFAULT_DAY = 45;
const MARKER = { w: 60, h: 48 };

/** Facilities out of at least one commodity by `day`, from the run's own stockout days. */
export function outByDay(events: ShockEvent[], day: number) {
  return new Set(
    events.filter((event) => event.day <= day).map((e) => e.facility_id),
  );
}

type Area = {
  id: string;
  name: string;
  facilities: PilotPanel["facilities"];
  lon: number;
  lat: number;
};

/** Areas at the mean of their synthetic facility coordinates, nudged apart so none overlap. */
export function placeAreas(
  areas: Area[],
  width: number,
  height: number,
): (Area & { x: number; y: number })[] {
  const lons = areas.map((a) => a.lon);
  const lats = areas.map((a) => a.lat);
  const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)];
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const span = (lo: number, hi: number) => hi - lo || 1;
  const points = areas.map((area) => ({
    ...area,
    x:
      MARKER.w / 2 +
      8 +
      ((area.lon - minLon) / span(minLon, maxLon)) * (width - MARKER.w - 16),
    y:
      MARKER.h / 2 +
      8 +
      ((maxLat - area.lat) / span(minLat, maxLat)) * (height - MARKER.h - 16),
  }));
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const [a, b] = [points[i], points[j]];
        if (
          Math.abs(a.x - b.x) < MARKER.w + 4 &&
          Math.abs(a.y - b.y) < MARKER.h + 4
        ) {
          const push = (MARKER.h + 4 - Math.abs(a.y - b.y)) / 2 + 1;
          const [top, bottom] = a.y <= b.y ? [a, b] : [b, a];
          top.y -= push;
          bottom.y += push;
          const side = (MARKER.w + 4 - Math.abs(a.x - b.x)) / 4;
          const [left, right] = a.x <= b.x ? [a, b] : [b, a];
          left.x -= side;
          right.x += side;
          moved = true;
        }
      }
    for (const point of points) {
      point.x = Math.min(
        width - MARKER.w / 2 - 4,
        Math.max(MARKER.w / 2 + 4, point.x),
      );
      point.y = Math.min(
        height - MARKER.h / 2 - 4,
        Math.max(MARKER.h / 2 + 4, point.y),
      );
    }
    if (!moved) break;
  }
  return points;
}

/**
 * "Watch it break": a day scrubber over the shown run, with each area's facilities out by
 * that day on a schematic map. Modeled, no intervention; positions are invented.
 */
export function WhereItBreaks({
  panel,
  events,
  risks,
  day,
  onDay,
  loading = false,
}: {
  /** True while the shown run is still loading: no counts are shown until it arrives. */
  loading?: boolean;
  panel: PilotPanel;
  /** Every stockout in the shown run. */
  events: ShockEvent[];
  risks: Record<string, FacilityRisk>;
  day: number;
  onDay: (day: number) => void;
}) {
  const { t, tf } = usePreferences();
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    setReduced(!!query?.matches);
  }, []);
  // Play is user-triggered only and steps one day at a time; it stops at the end.
  const dayRef = useRef(day);
  dayRef.current = day;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const next = Math.min(HORIZON, dayRef.current + 1);
      dayRef.current = next;
      onDay(next);
      if (next >= HORIZON) setPlaying(false);
    }, 120);
    return () => window.clearInterval(timer);
  }, [playing, onDay]);
  const map = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = map.current;
    if (!element) return;
    const measure = () =>
      setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  const out = outByDay(events, day);
  const soFar = events.filter((event) => event.day <= day).length;
  const areas: Area[] = panel.subcounties.flatMap((subcounty) => {
    const facilities = panel.facilities.filter(
      (f) => f.subcounty_id === subcounty.id,
    );
    const located = facilities.filter(
      (f) => typeof f.latitude === "number" && typeof f.longitude === "number",
    );
    if (!located.length) return [];
    return [
      {
        id: subcounty.id,
        name: subcounty.name,
        facilities,
        lon: located.reduce((sum, f) => sum + f.longitude!, 0) / located.length,
        lat: located.reduce((sum, f) => sum + f.latitude!, 0) / located.length,
      },
    ];
  });
  const legendHeight = 88;
  const placed =
    size.width > 0
      ? placeAreas(areas, size.width, Math.max(160, size.height - legendHeight))
      : [];
  const readout = tf("timelineReadout", {
    day,
    h: HORIZON,
    soFar,
    total: events.length,
    out: out.size,
    facilities: panel.facilities.length,
  });
  return (
    <section
      className="panel map-panel"
      aria-labelledby="where-title"
      aria-busy={loading}
    >
      <h2 id="where-title">{t("whereTitle")}</h2>
      <p className="sub">{t("whereSub")}</p>
      <div className="timeline">
        <div className="btn-row" role="group" aria-label={t("timelineLabel")}>
          <button
            type="button"
            className="btn"
            id="prev-week"
            aria-label={t("timelineBack")}
            disabled={day <= 0}
            onClick={() => onDay(Math.max(0, day - 7))}
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          {!reduced && (
            <button
              type="button"
              className="btn"
              id="play"
              aria-label={playing ? t("timelinePause") : t("timelinePlay")}
              onClick={() => {
                if (!playing && day >= HORIZON) onDay(0);
                setPlaying(!playing);
              }}
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                {playing ? (
                  <path d="M8 5v14M16 5v14" />
                ) : (
                  <path d="M8 5l11 7-11 7z" />
                )}
              </svg>
            </button>
          )}
          <button
            type="button"
            className="btn"
            id="next-week"
            aria-label={t("timelineForward")}
            disabled={day >= HORIZON}
            onClick={() => onDay(Math.min(HORIZON, day + 7))}
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div>
          <label className="visually-hidden" htmlFor="day">
            {tf("timelineDay", { h: HORIZON })}
          </label>
          <input
            id="day"
            type="range"
            min="0"
            max={HORIZON}
            value={day}
            onChange={(event) => {
              setPlaying(false);
              onDay(Number(event.target.value));
            }}
          />
        </div>
        {/* Announced when stepped or paused, not on every frame of playback. */}
        <p
          className="readout"
          id="readout"
          aria-live={playing ? "off" : "polite"}
        >
          {loading ? (
            t("timelineLoading")
          ) : (
            <>
              {readout} <span className="modeled">{t("timelineModeled")}</span>
            </>
          )}
        </p>
      </div>
      <div
        className="area-map"
        ref={map}
        role="group"
        aria-label={tf("areaMapLabel", { day })}
      >
        {placed.map((area) => {
          const count = area.facilities.filter((f) => out.has(f.id)).length;
          const level =
            count === 0
              ? "none"
              : count === area.facilities.length
                ? "all"
                : "some";
          return (
            <span
              key={area.id}
              className="area"
              role="img"
              data-out={loading ? "none" : level}
              style={{ left: area.x, top: area.y }}
              aria-label={
                loading
                  ? tf("areaLoadingLabel", {
                      area: area.name,
                      n: area.facilities.length,
                    })
                  : tf("areaLabel", {
                      area: area.name,
                      out: count,
                      n: area.facilities.length,
                      day,
                    })
              }
            >
              {loading ? "–" : count}/{area.facilities.length}
            </span>
          );
        })}
        <div className="map-legend">
          <strong>{tf("legendTitle", { day })}</strong>
          <span className="key">
            <span className="area-key" data-out="none" />
            {t("legendNone")}
          </span>
          <span className="key">
            <span className="area-key" data-out="some" />
            {t("legendSome")}
          </span>
          <span className="key">
            <span className="area-key" data-out="all" />
            {t("legendAll")}
          </span>
          <span className="key">{t("legendInvented")}</span>
        </div>
      </div>
      <ul className="areas" aria-label={t("areasLabel")}>
        {areas.map((area) => {
          const count = area.facilities.filter((f) => out.has(f.id)).length;
          const status = (s: string) =>
            area.facilities.filter((f) => risks[f.id]?.status === s).length;
          return (
            <li key={area.id}>
              <span>
                {loading
                  ? tf("areaRowLoading", {
                      area: area.name,
                      n: area.facilities.length,
                    })
                  : tf("areaRow", {
                      area: area.name,
                      out: count,
                      n: area.facilities.length,
                      day,
                    })}
              </span>
              {!loading && (
                <span className="mix" aria-label={t("areaMixLabel")}>
                  {tf("areaMix", {
                    critical: status("critical"),
                    watch: status("watch"),
                    stable: status("stable"),
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
