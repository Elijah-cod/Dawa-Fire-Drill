"use client";

import { useState } from "react";
import counties from "../data/counties.json";
import { CountyGrid } from "./county-grid";

export function NationalOverview() {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const county = counties.find((item) => item.code === selected);
  const visible = counties.filter((item) =>
    item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="eyebrow">Overview / Kenya</div>
      <h1>Where would you act first?</h1>
      <p className="lead">Rehearse a supply shock using synthetic examples.</p>
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
            <p>County planning data is unavailable.</p>
          </>
        ) : (
          <p>Select a county to inspect its synthetic planning information.</p>
        )}
      </section>
    </>
  );
}
