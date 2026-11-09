# 0001: Synthetic data from versioned, seeded generators

**Status:** accepted

## Context

The project needs facility-level stock, consumption, coordinates, routes and funding records to be useful, but real facility data is sensitive, hard to obtain and would invite readers to treat outputs as facts. The data also had to change several times as the design improved (for example, version 5 spread stockouts over weeks instead of one day and moved invented coordinates off Lake Victoria).

## Decision

All data comes from seeded generators in `apps/api/dawa_api/ingestion`. Each generator has an explicit version (the Kisumu county generator has versions 1 to 5); a new behaviour gets a new version and older versions keep producing the same output. Only some scale parameters are anchored to cited public aggregates, documented in `docs/data-assumptions.md`. Generated snapshots are stored in Postgres with their seed and version and are immutable to the application role. Every screen labels the data as invented and the outputs as illustrative.

## Consequences

- Any run can be reproduced from its seed, generator version and simulator version, and an old result stays explainable after the generator changes.
- Example cases planted by the generator (a facility already short on day 1, a stalled funding release, transfer routes for the earliest stockouts) make the demo legible.
- Nothing in the project says anything about real outcomes; the README and UI say so plainly.
- Adding real data later means writing an adapter (`dawa_api.ingestion.aggregate_adapters` is a stub that raises until configured), not changing the generators.
