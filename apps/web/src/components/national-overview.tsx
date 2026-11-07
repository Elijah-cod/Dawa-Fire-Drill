"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import counties from "../data/counties.json";
import type { components } from "../generated/api";
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
      <div className="eyebrow">Overview / Kenya</div>
      <h1>Where would you act first?</h1>
      <p className="lead">Rehearse a supply shock using synthetic examples.</p>
      <div role="status" aria-live="polite">
        {!online &&
          "Offline. County names remain available; planning data may be unavailable."}
        {status === "loading" && "Loading synthetic county planning data…"}
        {status === "error" && online && (
          <p>
            County planning data is unavailable.{" "}
            <button onClick={() => setAttempt(attempt + 1)}>Retry</button>
          </p>
        )}
        {status === "ready" &&
          data?.items.some((item) => item.planning === null) &&
          "Some county planning inputs are unavailable."}
      </div>
      <section className="panel" aria-label="County planning overview">
        <label htmlFor="county-search">Search counties</label>
        <input
          id="county-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {visible.length ? (
          <CountyGrid counties={visible} onSelect={setSelected} />
        ) : (
          <p>No counties match these filters.</p>
        )}
      </section>
      <section className="panel" aria-live="polite">
        {county ? (
          <>
            <h2>
              {county.name} · {county.code}
            </h2>
            <p>
              {county.code === "042"
                ? "Kisumu is the synthetic facility pilot."
                : "Planning overview only; facility simulation is not available."}
            </p>
            {planning &&
            typeof planning.approved === "number" &&
            typeof planning.released === "number" ? (
              <dl>
                <dt>Synthetic approved all-sector budget</dt>
                <dd>KES {planning.approved.toLocaleString("en-KE")}</dd>
                <dt>Synthetic release proxy</dt>
                <dd>KES {planning.released.toLocaleString("en-KE")}</dd>
              </dl>
            ) : (
              <p>County planning data is unavailable.</p>
            )}
          </>
        ) : (
          <p>Select a county to inspect its synthetic planning information.</p>
        )}
      </section>
    </>
  );
}
