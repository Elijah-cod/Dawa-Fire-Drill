"use client";

import { usePreferences } from "../preferences/preferences";

export type County = { code: string; name: string };

export function CountyGrid({
  counties,
  onSelect,
}: {
  counties: County[];
  onSelect: (code: string) => void;
}) {
  const { t } = usePreferences();
  return (
    <section aria-labelledby="county-grid-title">
      <h2 id="county-grid-title">{t("gridTitle")}</h2>
      <p>{t("gridDescription")}</p>
      <div className="county-grid" aria-label={t("gridLabel")}>
        {counties.map((county) => (
          <button
            type="button"
            key={county.code}
            aria-label={`${county.name}, ${t("county")} ${county.code}`}
            onClick={() => onSelect(county.code)}
          >
            {county.name}
          </button>
        ))}
      </div>
    </section>
  );
}
