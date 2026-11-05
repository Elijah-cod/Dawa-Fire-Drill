# Changelog

## Unreleased

- Added project agent rules, synthetic-data notice, design approval gate, and environment template.
- Expanded the working agreement and began splitting foundation configuration by service.
- Added typed backend settings with a required Postgres URL and validation tests.
- Added the foundation health endpoint, local service definitions, web tooling, and initial PR CI.
- Updated the workflow to keep all phase commits local until explicit production publication approval.
- Began Phase 1 design documentation and a Figma review file; frontend implementation remains gated.
- Added the responsive static design prototype, review checklist, and automated viewport checks.
- Recorded the user's Phase 1 design approval.
- Began illustrative backend stock-flow and OR-Tools budget selection primitives.
- Added initial funding diagnostics, forecasting baseline, and redistribution constraints.
- Added Kenya configuration and a second-country adapter stub, with synthetic-data calibration TODOs.
- Added scenario persistence, country-scoped repository operations, and an initial reversible migration.
- Added scenario row-level security and authenticated, role-checked scenario endpoints.
- Added a reproducible synthetic demo generator with documented calibration limits.
- Added optimizer tie handling, solver-based ordering and exclusion reasons, and corrected zero-demand stockout handling.
- Added an illustrative multi-facility scenario calculation over synthetic records.
- Added country-scoped persistent run records and a lease-fenced Postgres queue.
- Connected scenario run endpoints and a worker, and added migration/worker services to local Compose.
- Added an authenticated optimizer endpoint for illustrative synthetic candidates.
- Added synthetic bin-card capture with image validation, provider limits/cache, and human confirmation.
- Persisted versioned synthetic snapshots and prevented application-role edits to stored scenario inputs.
- Added country-scoped funding records and stage-specific diagnostics, plus synthetic forecasting and redistribution endpoints.
- Added a repeatable funding diagnostics command and optional Neo4j projection of immutable synthetic flows.
- Added a database-backed readiness endpoint that omits connection error details.
