"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import counties from "../data/counties.json";
import type { components } from "../generated/api";
import { usePreferences } from "../preferences/preferences";
import { CountyGrid } from "./county-grid";

type Overview = components["schemas"]["CountyOverview"];

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function NationalOverview({
  loadOverview,
}: {
  loadOverview: () => Promise<Overview>;
}) {
  const { t, locale } = usePreferences();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  useEffect(() => {
    let active = true;
    setStatus("loading");
    loadOverview().then(
      (result) => {
        if (active) {
          setData(result);
          setStatus("ready");
        }
      },
      () => {
        if (active) setStatus("error");
      },
    );
    return () => {
      active = false;
    };
  }, [loadOverview, attempt]);
  const county = counties.find((item) => item.code === selected);
  const planning = data?.items.find(
    (item) => item.county_code === selected,
  )?.planning;
  const visible = counties.filter((item) =>
    item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="eyebrow">{t("overview")} / Kenya</div>
      <h1>{t("overviewTitle")}</h1>
      <p className="lead">{t("overviewLead")}</p>
      <div role="status" aria-live="polite">
        {!online && t("offline")}
        {status === "loading" && t("loading")}
        {status === "error" && online && (
          <p>
            {t("unavailable")}{" "}
            <button onClick={() => setAttempt(attempt + 1)}>
              {t("retry")}
            </button>
          </p>
        )}
        {status === "ready" &&
          data?.items.some((item) => item.planning === null) &&
          t("partial")}
      </div>
      <section className="panel" aria-label={t("planningOverview")}>
        <label htmlFor="county-search">{t("search")}</label>
        <input
          id="county-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {visible.length ? (
          <CountyGrid counties={visible} onSelect={setSelected} />
        ) : (
          <p>{t("empty")}</p>
        )}
      </section>
      <section className="panel" aria-live="polite">
        {county ? (
          <>
            <h2>
              {county.name} · {county.code}
            </h2>
            <p>{county.code === "042" ? t("pilot") : t("planningOnly")}</p>
            {planning &&
            typeof planning.approved === "number" &&
            typeof planning.released === "number" ? (
              <dl>
                <dt>{t("approved")}</dt>
                <dd>
                  KES{" "}
                  {planning.approved.toLocaleString(
                    locale === "sw" ? "sw-KE" : "en-KE",
                  )}
                </dd>
                <dt>{t("released")}</dt>
                <dd>
                  KES{" "}
                  {planning.released.toLocaleString(
                    locale === "sw" ? "sw-KE" : "en-KE",
                  )}
                </dd>
              </dl>
            ) : (
              <p>{t("unavailable")}</p>
            )}
          </>
        ) : (
          <p>{t("selectCounty")}</p>
        )}
      </section>
    </>
  );
}
