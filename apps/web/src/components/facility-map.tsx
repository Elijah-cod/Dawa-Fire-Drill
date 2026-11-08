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
import { clusterPoints } from "./map-clusters";

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
 * Room around the markers: half a 44 px marker plus a margin on every side, and extra space
 * on the right (zoom controls) and bottom (attribution) so no marker sits under them.
 */
export const MAP_FIT_PADDING = Object.freeze({
  top: 40,
  left: 40,
  right: 72,
  bottom: 56,
});

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
              padding: MAP_FIT_PADDING,
              maxZoom: 12,
              duration: 0,
            });
          fit();
          // Keep every marker in view when the container changes size (e.g. the mobile sheet).
          map.on("resize", fit);
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
                const breakdown = (
                  ["critical", "watch", "stable", "unknown"] as const
                )
                  .filter((status) => counts[status])
                  .map((status) => `${counts[status]} ${t(status)}`)
                  .join(", ");
                const label = `${members.length} ${t("clusterFacilities")} · ${t("clusterWorst")}: ${t(worst)} · ${breakdown}. ${t("clusterZoom")}`;
                button.className = `facility-marker facility-cluster facility-marker--${worst}`;
                button.dataset.count = String(members.length);
                button.setAttribute("aria-label", label);
                button.title = `${label} ${legend}`;
                symbol.textContent = symbols[worst];
                const text = document.createElement("span");
                text.setAttribute("aria-hidden", "true");
                text.textContent = `${members.length} · ${t(worst)}`;
                button.append(symbol, text);
                const area = new library.LngLatBounds();
                for (const item of members)
                  area.extend([item.longitude, item.latitude]);
                button.addEventListener("click", () => {
                  focusId = members[0].facility.id;
                  map?.fitBounds(area, {
                    padding: MAP_FIT_PADDING,
                    maxZoom: 18,
                    duration: 0,
                  });
                });
                position = [
                  members.reduce((sum, item) => sum + item.longitude, 0) /
                    members.length,
                  members.reduce((sum, item) => sum + item.latitude, 0) /
                    members.length,
                ];
              }
              placed.push({
                marker: new library.Marker({ element: button })
                  .setLngLat(position)
                  .addTo(map),
                ids: members.map((item) => item.facility.id),
              });
            }
            // After a cluster zoom, keep keyboard focus on the group's first facility.
            if (focusId) {
              const target = placed.find((item) => item.ids.includes(focusId!));
              focusId = null;
              target?.marker.getElement().focus();
            }
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
