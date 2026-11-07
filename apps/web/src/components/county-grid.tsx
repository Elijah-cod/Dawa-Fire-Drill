"use client";

import { usePreferences } from "../preferences/preferences";
import { useId } from "react";

export type County = { code: string; name: string };

export function CountyGrid({
  counties,
  onSelect,
}: {
  counties: County[];
  onSelect: (code: string) => void;
}) {
  const { t } = usePreferences();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>{t("gridTitle")}</h2>
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
