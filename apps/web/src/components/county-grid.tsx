"use client";

export type County = { code: string; name: string };

export function CountyGrid({
  counties,
  onSelect,
}: {
  counties: County[];
  onSelect: (code: string) => void;
}) {
  return (
    <section aria-labelledby="county-grid-title">
      <h2 id="county-grid-title">Kenya counties</h2>
      <p>Schematic, not to scale. Select a county for planning information.</p>
      <div className="county-grid" aria-label="Schematic county grid">
        {counties.map((county) => (
          <button
            type="button"
            key={county.code}
            aria-label={`${county.name}, county ${county.code}`}
            onClick={() => onSelect(county.code)}
          >
            {county.name}
          </button>
        ))}
      </div>
    </section>
  );
}
