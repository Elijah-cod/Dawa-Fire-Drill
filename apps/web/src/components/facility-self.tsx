"use client";

import type { FacilityView } from "../api/client";
import { useCallback, useRef } from "react";
import { usePreferences } from "../preferences/preferences";
import { FacilityMap } from "./facility-map";

export function FacilitySelf({ data }: { data: FacilityView }) {
  const { t } = usePreferences();
  const heading = useRef<HTMLHeadingElement>(null);
  const select = useCallback(() => heading.current?.focus(), []);
  const stock = data.stock.filter(
    (item) => item.facility_id === data.facility.id,
  );
  return (
    <>
      <p>
        <a href="/">Kenya</a> / Kisumu
      </p>
      <h1 ref={heading} tabIndex={-1}>
        {data.facility.name} · {data.facility.id}
      </h1>
      <p>{t("syntheticNote")}</p>
      <section className="panel">
        <FacilityMap
          facilities={[data.facility]}
          risks={{}}
          onSelect={select}
        />
      </section>
      <section className="panel">
        <h2>{t("openingStock")}</h2>
        {stock.length ? (
          <ul>
            {stock.map((item) => (
              <li key={item.commodity_id}>
                {item.commodity_id} · {item.opening_stock}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("noStock")}</p>
        )}
      </section>
    </>
  );
}
