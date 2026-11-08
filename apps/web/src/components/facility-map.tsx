"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePreferences } from "../preferences/preferences";
import { riskLegend, type FacilityRisk, type Risk } from "../risk/risk";

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
}: {
  facilities: MapFacility[];
  risks: Record<string, FacilityRisk>;
  onSelect?: (id: string) => void;
  /** Facilities short regardless of the shock (pre-shock gaps or no-shock stockouts). */
  preShock?: ReadonlySet<string>;
}) {
  const { t, locale } = usePreferences();
  const container = useRef<HTMLDivElement>(null);
  const [mapNearViewport, setMapNearViewport] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const markers = useMemo(
    () => facilityMarkers(facilities, risks),
    [facilities, risks],
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
          for (const marker of markers) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `facility-marker facility-marker--${marker.risk}`;
            const time =
              marker.risk === "unknown"
                ? t("noRiskData")
                : marker.result.days === null
                  ? t("noStockout")
                  : `${marker.result.days} ${t("days")}`;
            const short = preShock?.has(marker.facility.id)
              ? ` · ${t("alreadyShort")}`
              : "";
            const description = `${marker.facility.name} · ${t(marker.risk)}${short} · ${time} · ${t("drivers")}: ${marker.result.drivers.join(", ") || "—"}`;
            button.setAttribute("aria-label", description);
            button.title = `${description}. ${riskLegend(locale).join("; ")}`;
            const symbol = document.createElement("span");
            symbol.setAttribute("aria-hidden", "true");
            symbol.textContent = marker.symbol;
            button.append(symbol);
            button.addEventListener("click", () =>
              onSelect?.(marker.facility.id),
            );
            new library.Marker({ element: button })
              .setLngLat([marker.longitude, marker.latitude])
              .addTo(map);
          }
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
      </section>
    </section>
  );
}
