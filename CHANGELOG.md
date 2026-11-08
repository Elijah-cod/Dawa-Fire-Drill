# Changelog

- Navigation: "Funding trace" opens the Kisumu Funding trace tab with focus on its heading, "Bin-card capture" works from any page, the sidebar and bottom bar highlight exactly the view the URL shows, and back and forward restore the view and highlight. The sidebar no longer repeats the synthetic note.

- Kisumu: the framing question shows at once while the first run loads; shock, budget, tab and day are kept in the URL so a link recreates the view; the phone tab strip shows that it scrolls; README screenshots and the Swahili review list are refreshed, and the page-load performance gap is documented.

- Kisumu app redesign (from the approved preview): a verdict that answers what breaks first, how far the fixes reach and the cheapest fix; four prepared shocks with a no-shock comparison; tabs for map and fixes, stockout order, funding trace and facilities; a live budget slider in illustrative cost units with a cut line, paired options and "Why these picks?"; a sortable facilities table with filters and a detail panel; a "Where it breaks" timeline with a schematic area map. Invented facility display names, the self-hosted Source Serif 4 display face, a precise About panel and a compact phone header.

- Kisumu preview: the verdict and fixes header state how many shock-caused stockouts the options address; costs are labelled KES (illustrative); the loading verdict no longer states a result; the budget control stays visible and disabled when there is nothing to rank.

- Kisumu preview: page title, section headings and verdict use self-hosted Source Serif 4 (OFL) with a metric-matched fallback; the verdict and budget status reserve their space so changing the budget no longer moves the page.

- Refreshed README screenshots, demo script and limitations; listed all Swahili strings for review and added a Checkpoint C checklist.

- Added a favicon. Browser tests now cover the guided demo, funding trace, bin-card capture and clustered map in Swahili with the dark theme, including accessibility checks and the English-only note on the optimizer explanation.

- Bin-card capture moves focus to the first empty field when extraction returns empty or partial values, and styles “Confirm and save” as the primary button.

- The funding trace shows a four-step stage bar with the stalled stage marked by a pause symbol, “Stalled here” and a dashed border, and a two-column bottleneck detail.

- Added Kisumu, funding trace and bin-card capture links to the sidebar and a phone bottom navigation bar; the capture link opens the facility in-charge view.

- Map clusters now show their status mix (for example “6 · 2 Crit · 3 Watch · 1 Stable”) with the worst-status symbol, never overlap, and keep zooming in on repeated Enter with focus kept on the same facility.

- Recaptured the README facility-map screenshot with clusters and the counts line, and updated the map limitation.

- The facility map groups nearby facilities into one keyboard-accessible cluster per area at low zoom, labeled with the count and worst status (for example “6 · Critical”); activating a cluster zooms in and separates it. A line under the legend always shows Critical, Watch and Stable counts and how many facilities were already short before the shock.

- The local demo session raises the per-subject rate limit to 1,200 requests per minute (from 600) so the full browser suite fits; `demo-down.sh` still restores 60.

- Updated browser checks, Lighthouse results and README screenshots for the new risk cutoffs; added a facility-map screenshot at 40%.

- Shortened the “Do this first” intro to two lines and moved the cost assumptions and targeted stockouts behind “How these options are built”.

- The facility map fits all markers with padding that clears the zoom and attribution controls, and refits when it is resized.

- Facilities that are short regardless of the shock (seed 42: SYN-KE-042-F001 and SYN-KE-042-F003) now show “Already short before the shock” next to their risk status in the map tooltip and facility panel.

- Changed the illustrative facility risk cutoffs to Critical within 45 days, Watch 46–52 days and Stable beyond 52 days, chosen from real generator version 5 runs; the legend now says the cutoffs are relative to the 90-day horizon and were tuned for readability, not a standard.

- Moved the stockout summary into the shock card's reserved space and removed the separate stockout panel.

- Ranked fixes now cover the four earliest shock-caused stockouts with planted transfer and emergency candidates, so a 30 KES ceiling funds some and cuts others with the remaining budget named as the reason.

- Replaced the long shock-caused stockout list with a summary line (counts against no shock, first stockout, busiest week) and kept the full order behind a disclosure; removed the same-day line.

- The facility map shows “Map tiles are unavailable” only after a basemap tile actually fails and none has loaded; aborted tile requests and non-tile map errors no longer trigger it.

- Kisumu generator version 5 keeps every invented facility location on land; earlier versions placed 12 seed-42 markers in Lake Victoria.

- Added Kisumu generator version 5 with varied synthetic opening cover so 40% shock stockouts spread over several weeks instead of nearly all landing on day 48; versions 1–4 are unchanged.

- Rewrote the README with screenshots, a demo-session quickstart, a three-minute demo script and a limitations section.

- Added online-only synthetic bin-card upload for the facility in-charge, with photo preview, editable fields, and an explicit human confirmation before saving.

- Added a guided 3-minute demo with per-step captions, Back, Next and Exit controls, Escape to exit, and URL-kept progress from the national overview to bin-card capture.

- The interactive Lighthouse flow applies its performance budget to the measured interaction only and matches Lighthouse's mobile viewport; results are recorded in progress notes.

- Began the funding trace for the synthetic stalled-release flow: stage amounts, backend-aged delayed amounts, bottleneck inspection, and loading, error, empty and offline states.

- The shock-caused stockout panel now names other commodities at the first facility that run out on the same day.

- Added local-only `scripts/demo-up.sh` and `scripts/demo-down.sh` to start and tear down a synthetic browser demo session with disposable signing material and a 4-hour token passed only by environment.

- Replaced the 2.4 MB hand-carried Kisumu development fixture with a 0.3 MB compact one regenerated by `apps/web/scripts/build-fixtures.mjs` from backend generator version 4, seed 42, keeping the last three consumption months.

- Reserved space for the shock-order and ranked-fixes panels so arriving synthetic results no longer shift the Kisumu page.

- Ranked fixes now list every synthetic candidate with its cost, modeled deferral and status on either side of an explicit budget cut line, with costs labeled once as an illustrative assumption.

- Added an immutable version 4 synthetic Kisumu panel whose planted transfer targets the first shock-caused demo stockout; retained prior versions.

- Began an optimizer-backed first-stockout action panel with a budget ceiling, exclusion reasons, synthetic assumptions, and a recorded development fixture; screen review and performance gate remain open.

- Connected the in-progress Kisumu facility view to scoped synthetic panel data and selected scenario runs, with role-restricted facility access and explicit partial-data messaging.

- Added shared illustrative facility-risk thresholds and a synthetic-coordinate MapLibre component with a no-coordinate fallback.

- Added version 3 synthetic Kisumu facility coordinates with clustered seeded locations and a route-distance consistency check; older snapshots remain unchanged.

- Added a mobile schematic map sheet and synchronized county list, with keyboard focus return and background scroll locking.

- Added English and Swahili copy and light, dark, and system theme controls to the in-progress national view.

- Connected the in-progress national overview to typed synthetic planning data and verified demo role changes against the backend capability.

- Added typed same-origin demo-session, capability and national overview reads using the updated OpenAPI schema.

- Exposed the authenticated demo session's trusted role and scope without returning credentials.

- Added an initial server-only local demo proxy, session abstraction, synthetic role fixtures, and national-view scaffold. The frontend remains incomplete.

- Added an authenticated demo-capability endpoint so the server proxy can determine whether role switching is enabled.

- Began the Phase 3 frontend with a testable schematic county grid and documented boundary-license uncertainty.

- Distinguished pre-shock shortages and shock-caused stockouts using a no-shock counterfactual, ranked a fix for the first shock-caused event, and labeled the synthetic Kisumu funding trace in KES.

- Documented the fresh-clone county demo, local timing sample, and Checkpoint B limitations; strengthened county-capture row-level security coverage.

- Updated the curl demo to exercise county planning, the Kisumu shock, mitigation explanation and facility capture.

- Added a separate county-scoped Kisumu facility bin-card capture and human-confirmation workflow.

- Added an opt-in administrator-only demo role switcher for local or staging environments, refused in production.

- Added a Kisumu run forecast from pinned synthetic inputs and a deterministic explanation of the optimizer result.

- Calibrated version 2 synthetic county budget scales to published county aggregates, retaining invented release shares and immutable older snapshots.
- Added an integration comparison of synthetic redistribution and emergency-delivery costs in the Kisumu mitigation workflow.

## Unreleased

- Block county-scoped identities from legacy country-only data paths pending their migration.
- Add a scoped funding trace for the synthetic Kisumu stalled-release case.
- Add county-scoped asynchronous Kisumu runs and modeled mitigation ranking against pinned pilot inputs.
- Add an idempotent CLI to seed all county planning snapshots and the Kisumu pilot.
- Add a Kisumu facility view that limits facility-role users to their own synthetic records.
- Expose scoped synthetic county planning and Kisumu pilot snapshots to authorized roles.
- Validate trusted county and national-planning claims in preparation for county access control.
- Persist synthetic county planning and Kisumu pilot snapshots behind a county-scoped repository.
- Add county-scoped immutable snapshot storage with forced row-level security and a Kisumu-only pilot constraint.
- Simulate the isolated Kisumu panel with its synthetic opening stock and sub-county stockout roll-ups.
- Add an isolated synthetic Kisumu facility panel and planted demo inputs, pending scenario integration.
- Generate reproducible 47-county synthetic planning proxies anchored to published all-sector totals.
- Make OR-Tools tie ordering tractable for the maximum supported candidate count.
- Add a county overview and Kisumu pilot design addendum, including responsive and failure states.
- Begin Phase 2b with an official Kenya county and Kisumu sub-county reference directory.
- Add a public health-sector first-quarter release proxy to synthetic funding records, with scope limitations.
- Update the synthetic demo to rank replayed emergency-delivery effects.
- Include the selected reasons and cut line in modeled mitigation results.
- Anchor the total synthetic funding scale to a published procurement-value proxy while keeping funding stages explicitly assumed.
- Add public-aggregate proxies for all ten synthetic tracer demand series, with source periods and scaling limitations.
- Preserve low-volume synthetic monthly demand with fixed-point stock calculations in simulation version 4.
- Prevent simultaneous modeled donor and recipient actions on the same facility and commodity.
- Anchor three synthetic malaria tracer need proxies to a public national projection, with explicit scaling limitations.
- Use synthetic lead-time anchors in simulation version 3 while preserving legacy run replay.
- Model synthetic redistribution with donor stock preservation, shared inventory, distance, and shelf-life constraints.
- Replay synthetic reorder-timing candidates by advancing an existing replenishment without duplicating stock.
- Add run-pinned synthetic emergency-delivery replay and solver ranking by modeled first-stockout deferral.
- Anchor version-2 synthetic facility lead times to published national turnaround aggregates, with explicit provenance and modelling limitations.
- Added least-cost optimization for an optional caller-supplied synthetic benefit target.
- Preserve approved prototype screenshots when running the browser verification script.
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
- Added scenario-linked ranking of caller-supplied synthetic mitigation candidates.
- Added request IDs and minimal structured request events without headers or query strings.
- Added a rolling moving-average backtest exercised on synthetic consumption.
- Enforced a shared Postgres-backed request limit for authenticated principals.
- Clarified the current partial calibration of synthetic data in the README and API documentation.
- Fixed API prefix configuration when settings are loaded from the environment.
- Added a deterministic plain-language fallback that restates optimizer results.
- Added an authenticated side-by-side comparison of two completed scenario runs.
- Added Supabase ES256/RS256 JWKS signature verification alongside legacy HS256.
- Added optional, constrained OpenAI/Gemini explanation phrasing with a shared daily call cap and deterministic fallback.
- Changed stock simulation to advance between delivery and depletion events with property checks against daily replay.
- Added a synthetic seed, scenario, and mitigation curl demo script.
- Restricted country-wide scenario and run retrieval to planning roles; facility users retain scoped capture access.
- Added synthetic district/commodity stockout summaries and a simulation version marker.
- Added Neo4j uniqueness constraints for funding flow and stage projection keys.
- Added OpenAPI fuzz coverage for forecasts and aligned request validation and documented auth responses.
- Required explicit synthetic-data attestations and human-review confirmation across applicable endpoints.
- Added a multipage funding-graph rebuild regression test.
- Added an explicit unconfigured adapter boundary for public calibration aggregates.
- Extended non-superuser country isolation tests to funding records and request-limit counters.
- Prevented scenario mitigation alternatives for the same stockout from being double-counted.
- Pinned generator and simulation versions when runs are queued, retaining the earlier simulation output format.
- Bounded each optimizer solve and return a sanitized error when optimality cannot be proven.
- Extended OpenAPI fuzz checks to optimization and aligned numeric and conflict responses with its contract.
- Added a repeatable synthetic simulation timing benchmark.
- Added a local Locust smoke workload for health, forecast, and optimization endpoints.
- Added OR-Tools multi-facility redistribution matching with stock, distance, and shelf-life constraints.
- Restricted mitigation identifiers to safe alphanumeric, underscore, and hyphen characters.
- Reconciled Phase 2 review notes with implemented backend capabilities and remaining gaps.
- Added redistribution matching tests for invalid lanes, role checks, and solver failure handling.
- Added paginated, country-scoped synthetic facility and commodity catalog endpoints.
- Updated the local quickstart and CI smoke checks for readiness and synthetic seeding.
- Added an illustrative stockout-period forecast when synthetic stock on hand is supplied.
- Added a bounded per-instance Supabase JWKS cache with fail-closed expiry.
- Added an injectable queue interface for the scenario worker.
- Added country adapter classes for Kenya and an explicitly disabled second-country stub.
