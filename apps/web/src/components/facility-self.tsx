"use client";

import type {
  BinCardFields,
  CaptureConfirmed,
  CaptureRead,
  FacilityView,
} from "../api/client";
import { useCallback, useRef } from "react";
import { usePreferences } from "../preferences/preferences";
import { BinCardCapture } from "./bin-card-capture";
import { FacilityMap } from "./facility-map";

export type CaptureApi = {
  upload: (file: File, key: string) => Promise<CaptureRead>;
  confirm: (
    captureId: string,
    fields: BinCardFields,
  ) => Promise<CaptureConfirmed>;
};

export function FacilitySelf({
  data,
  capture,
}: {
  data: FacilityView;
  capture?: CaptureApi;
}) {
  const { t } = usePreferences();
  const heading = useRef<HTMLHeadingElement>(null);
  const select = useCallback(() => heading.current?.focus(), []);
  const stock = data.stock.filter(
    (item) => item.facility_id === data.facility.id,
  );
  return (
    <>
      <p>
        <a className="underline" href="/">
          Kenya
        </a>{" "}
        / Kisumu
      </p>
      <h1 ref={heading} tabIndex={-1}>
        {data.facility.name} · {data.facility.id}
      </h1>
      <p>{t("syntheticNote")}</p>
      {capture && (
        <BinCardCapture
          facilityId={data.facility.id}
          upload={capture.upload}
          confirm={capture.confirm}
        />
      )}
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
