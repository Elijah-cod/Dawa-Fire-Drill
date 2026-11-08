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

export function FacilityMap({
  facilities,
  risks,
  onSelect,
}: {
  facilities: MapFacility[];
  risks: Record<string, FacilityRisk>;
  onSelect?: (id: string) => void;
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
          map.on("error", () => setTilesUnavailable(true));
          map.fitBounds(bounds, { padding: 35, maxZoom: 12, duration: 0 });
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
            const description = `${marker.facility.name} · ${t(marker.risk)} · ${time} · ${t("drivers")}: ${marker.result.drivers.join(", ") || "—"}`;
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
  }, [markers, locale, onSelect, t, mapNearViewport]);

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
