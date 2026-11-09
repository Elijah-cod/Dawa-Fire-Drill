# 0004: Deterministic, versioned simulation

**Status:** accepted

## Context

Planners compare scenarios (no shock against a 40% cut, or 20% against 40%). Comparisons are meaningless if the same inputs can give different stockout days, or if a simulator fix silently changes old results.

## Decision

The simulator (`dawa_api.simulation`) is deterministic for a given snapshot, scenario and seed, and carries an explicit `simulation_version` (currently 1 and 2) stored with each run. Runs are pinned to the snapshot and simulator version they were submitted with. Shock-caused stockouts are reported separately from those that also happen without the shock (pre-shock gaps and no-shock stockouts).

## Consequences

- The web fixtures and browser tests can assert exact figures (for example 209 shock-caused stockouts at 40%, first on day 41) against the live backend.
- A behaviour change requires a new simulator version rather than an edit, so stored runs remain reproducible.
- The model is deliberately simple (daily demand, scheduled deliveries, a percentage cut); its assumptions are listed in `docs/data-assumptions.md`.
