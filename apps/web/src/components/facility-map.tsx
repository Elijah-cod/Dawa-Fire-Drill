"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePreferences } from "../preferences/preferences";
import {
  riskLegend,
  riskSummary,
  worstStatus,
  type FacilityRisk,
  type Risk,
} from "../risk/risk";
import { clusterPoints, clusterText, statusMix } from "./map-clusters";

export type MapFacility = {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  coordinates_synthetic?: boolean;
};
type Marker = {
  facility: MapFacility;
  latitude: number;
  longitude: number;
  risk: Risk;
  symbol: string;
  result: FacilityRisk;
};
const symbols: Record<Risk, string> = {
  critical: "!",
  watch: "△",
  stable: "✓",
  unknown: "?",
};

export function facilityMarkers(
  facilities: MapFacility[],
  risks: Record<string, FacilityRisk>,
): Marker[] {
  return facilities.flatMap((facility) => {
    const { latitude, longitude } = facility;
    if (
      facility.coordinates_synthetic !== true ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      return [];
    const result = risks[facility.id] ?? {
      status: "unknown",
      drivers: [],
      days: null,
    };
    return [
      {
        facility,
        latitude,
        longitude,
        risk: result.status,
        symbol: symbols[result.status],
        result,
      },
    ];
  });
}

/**
 * Room around the markers: half of a cluster pill (at most 160 px wide, wrapping to two lines)
 * plus a margin left and right, half a 44 px marker plus a margin above and below, and extra space on
 * the right (zoom controls) and bottom (attribution) so nothing sits under them.
 */
export const MAP_FIT_PADDING = Object.freeze({
  top: 40,
  left: 88,
  right: 120,
  bottom: 56,
});

/** Narrow maps keep proportionally less side padding so phones are not zoomed far out. */
export function mapFitPadding(width: number) {
  const scale = Math.min(1, Math.max(0, width) / 900);
  return {
    top: MAP_FIT_PADDING.top,
    bottom: MAP_FIT_PADDING.bottom,
    left: Math.max(48, Math.round(MAP_FIT_PADDING.left * scale)),
    right: Math.max(64, Math.round(MAP_FIT_PADDING.right * scale)),
  };
}

export function FacilityMap({
  facilities,
  risks,
  onSelect,
  preShock,
  magnitude,
}: {
  facilities: MapFacility[];
  risks: Record<string, FacilityRisk>;
  onSelect?: (id: string) => void;
  /** Facilities short regardless of the shock (pre-shock gaps or no-shock stockouts). */
  preShock?: ReadonlySet<string>;
  /** Selected shock (%); shows the always-visible status counts under the legend. */
  magnitude?: number;
}) {
  const { t, locale } = usePreferences();
  const container = useRef<HTMLDivElement>(null);
  const [mapNearViewport, setMapNearViewport] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const markers = useMemo(
    () => facilityMarkers(facilities, risks),
    [facilities, risks],
  );
  const summary = useMemo(
    () =>
      riskSummary(
        facilities.map((item) => item.id),
        risks,
        preShock,
      ),
    [facilities, risks, preShock],
  );
  useEffect(() => {
    if (!container.current || !markers.length || mapNearViewport) return;
    if (typeof IntersectionObserver === "undefined") {
      setMapNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMapNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [markers.length, mapNearViewport]);
  useEffect(() => {
    if (!container.current || !markers.length || !mapNearViewport) return;
    let removed = false;
    let map: import("maplibre-gl").Map | undefined;
    void import("maplibre-gl")
      .then((library) => {
        if (removed || !container.current) return;
        try {
          const bounds = new library.LngLatBounds();
          for (const marker of markers)
            bounds.extend([marker.longitude, marker.latitude]);
          map = new library.Map({
            container: container.current,
            style: {
              version: 8,
              sources: {
                osm: {
                  type: "raster",
                  tiles: [
                    process.env.NEXT_PUBLIC_OSM_TILE_URL ||
                      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                  ],
                  tileSize: 256,
                  attribution:
                    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                },
              },
              layers: [{ id: "osm", type: "raster", source: "osm" }],
            },
            center: [markers[0].longitude, markers[0].latitude],
            zoom: 9,
          });
          // Only failed basemap tiles count; aborted requests (e.g. after fitBounds) and
          // non-tile errors do not. A tile that loads clears the message.
          let tilesLoaded = 0;
          map.on("data", (event) => {
            if (
              event.dataType === "source" &&
              "sourceId" in event &&
              event.sourceId === "osm" &&
              "tile" in event &&
              event.tile
            ) {
              tilesLoaded++;
              setTilesUnavailable(false);
            }
          });
          map.on("error", (event) => {
            const tileError =
              ("sourceId" in event && event.sourceId === "osm") ||
              ("tile" in event && Boolean(event.tile));
            const name = (event.error as { name?: unknown } | undefined)?.name;
            if (!tileError || name === "AbortError") return;
            if (!tilesLoaded) setTilesUnavailable(true);
          });
          const fit = () =>
            map?.fitBounds(bounds, {
              padding: mapFitPadding(container.current?.clientWidth ?? 0),
              maxZoom: 12,
              duration: 0,
            });
          fit();
          // Keep every marker in view when the container resizes (e.g. the mobile sheet),
          // but never undo a zoom or pan the user made, such as opening a cluster.
          let followBounds = true;
          map.on("resize", () => {
            if (followBounds) fit();
          });
          for (const type of ["zoomstart", "dragstart"] as const)
            map.on(type, (event) => {
              if ("originalEvent" in event && event.originalEvent)
                followBounds = false;
            });
          map.addControl(
            new library.NavigationControl({ visualizePitch: false }),
          );
          const describe = (marker: Marker) => {
            const time =
              marker.risk === "unknown"
                ? t("noRiskData")
                : marker.result.days === null
                  ? t("noStockout")
                  : `${marker.result.days} ${t("days")}`;
            const short = preShock?.has(marker.facility.id)
              ? ` · ${t("alreadyShort")}`
              : "";
            return `${marker.facility.name} · ${t(marker.risk)}${short} · ${time} · ${t("drivers")}: ${marker.result.drivers.join(", ") || "—"}`;
          };
          const legend = riskLegend(locale).join("; ");
          let placed: {
            marker: import("maplibre-gl").Marker;
            ids: string[];
          }[] = [];
          let focusId: string | null = null;
          // Regroup on every move: nearby markers share one cluster button at low zoom.
          const render = () => {
            if (!map) return;
            // Keep keyboard focus on the facility it was on, whatever re-renders the markers.
            const active = placed.find(
              (item) => item.marker.getElement() === document.activeElement,
            );
            const keep = focusId ?? active?.ids[0] ?? null;
            focusId = null;
            for (const item of placed) item.marker.remove();
            placed = [];
            const projected = markers.map((marker) => ({
              marker,
              ...map!.project([marker.longitude, marker.latitude]),
            }));
            for (const group of clusterPoints(projected)) {
              const members = group.map((item) => item.marker);
              const button = document.createElement("button");
              button.type = "button";
              const symbol = document.createElement("span");
              symbol.setAttribute("aria-hidden", "true");
              let position: [number, number];
              if (members.length === 1) {
                const [marker] = members;
                const description = describe(marker);
                button.className = `facility-marker facility-marker--${marker.risk}`;
                button.setAttribute("aria-label", description);
                button.title = `${description}. ${legend}`;
                symbol.textContent = marker.symbol;
                button.append(symbol);
                button.addEventListener("click", () =>
                  onSelect?.(marker.facility.id),
                );
                position = [marker.longitude, marker.latitude];
              } else {
                const worst = worstStatus(members.map((item) => item.risk));
                const counts = riskSummary(
                  members.map((item) => item.facility.id),
                  Object.fromEntries(
                    members.map((item) => [item.facility.id, item.result]),
                  ),
                );
                const visible = clusterText(members.length, counts, {
                  critical: t("shortCritical"),
                  watch: t("shortWatch"),
                  stable: t("shortStable"),
                  unknown: t("shortUnknown"),
                });
                const breakdown = statusMix(counts)
                  .map(([status, count]) => `${count} ${t(status)}`)
                  .join(", ");
                // Starts with the visible text so the accessible name contains it.
                const label = `${visible} · ${members.length} ${t("clusterFacilities")}: ${breakdown}; ${t("clusterWorst")} ${t(worst)}. ${t("clusterZoom")}`;
                button.className = `facility-marker facility-cluster facility-marker--${worst}`;
                button.dataset.count = String(members.length);
                button.setAttribute("aria-label", label);
                button.title = `${label} ${legend}`;
                symbol.textContent = symbols[worst];
                const text = document.createElement("span");
                text.setAttribute("aria-hidden", "true");
                text.textContent = visible;
                button.append(symbol, text);
                position = [
                  members.reduce((sum, item) => sum + item.longitude, 0) /
                    members.length,
                  members.reduce((sum, item) => sum + item.latitude, 0) /
                    members.length,
                ];
                const area = new library.LngLatBounds();
                for (const item of members)
                  area.extend([item.longitude, item.latitude]);
                button.addEventListener("click", () => {
                  if (!map) return;
                  followBounds = false;
                  focusId = members[0].facility.id;
                  const before = map.getZoom();
                  map.fitBounds(area, {
                    padding: mapFitPadding(container.current?.clientWidth ?? 0),
                    maxZoom: 18,
                    duration: 0,
                  });
                  // A cluster spanning most of the view barely zooms when fitted; always
                  // advance so repeated Enter keeps separating it.
                  if (map.getZoom() < before + 1)
                    map.jumpTo({
                      center: position,
                      zoom: Math.min(18, before + 2),
                    });
                });
              }
              placed.push({
                marker: new library.Marker({ element: button })
                  .setLngLat(position)
                  .addTo(map),
                ids: members.map((item) => item.facility.id),
              });
            }
            // A wide cluster label near the edge of a narrow map can overhang it; nudge the
            // label sideways so it stays inside, still over its own area. Measured on the next
            // frame, once MapLibre has positioned the markers.
            const current = placed;
            requestAnimationFrame(() => {
              const frame = container.current?.getBoundingClientRect();
              if (!frame || frame.width === 0 || current !== placed) return;
              for (const item of current) {
                const box = item.marker.getElement().getBoundingClientRect();
                const shift =
                  box.left < frame.left + 4
                    ? frame.left + 4 - box.left
                    : box.right > frame.right - 4
                      ? frame.right - 4 - box.right
                      : 0;
                if (shift) item.marker.setOffset([shift, 0]);
              }
            });
            // After a cluster zoom, focus moves to the group's first facility.
            if (keep)
              placed
                .find((item) => item.ids.includes(keep))
                ?.marker.getElement()
                .focus();
          };
          map.on("moveend", render);
          render();
        } catch {
          setTilesUnavailable(true);
        }
      })
      .catch(() => setTilesUnavailable(true));
    return () => {
      removed = true;
      map?.remove();
    };
  }, [markers, locale, onSelect, t, mapNearViewport, preShock]);

  if (!markers.length) return <p>{t("facilityMapUnavailable")}</p>;
  return (
    <section aria-labelledby="facility-map-title">
      <h2 id="facility-map-title">{t("facilityLocationsSynthetic")}</h2>
      {markers.length !== facilities.length && (
        <p role="status">{t("facilityMapPartial")}</p>
      )}
      {tilesUnavailable && <p role="status">{t("mapTilesUnavailable")}</p>}
      <div
        className="facility-map"
        ref={container}
        role="group"
        aria-label={t("facilityLocationsSynthetic")}
      />
      <section aria-label={t("riskLegend")}>
        <h3>{t("riskLegend")}</h3>
        <ul>
          {riskLegend(locale).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {magnitude !== undefined && (
          <p className="risk-summary" role="status">
            {magnitude}% {t("summaryShock")} · {summary.total}{" "}
            {t("summaryFacilities")}: {summary.critical} {t("critical")} ·{" "}
            {summary.watch} {t("watch")} · {summary.stable} {t("stable")}
            {summary.unknown > 0 &&
              ` · ${summary.unknown} ${t("unknown")}`} · {summary.alreadyShort}{" "}
            {t("alreadyShortCount")}
          </p>
        )}
      </section>
    </section>
  );
}
