# County and Kisumu pilot design addendum

**Status: approved design specification.** This extends the approved Phase 1 design. Show “Synthetic data. Model outputs are illustrative and unvalidated.” on every screen. Administrative names are real reference labels; all displayed operational and funding values are synthetic. Do not claim real Kisumu disease burden, donor dependence, or intervention impact without a cited source.

The primary question is: **“What breaks first in Kisumu if donor-funded logistics support drops 40%, and what is the cheapest fix?”** The 40% shock is a planner-selected synthetic scenario, not an assertion about actual funding. The cheapest fix means the lowest modeled cost meeting the planner's explicit synthetic protection target, subject to the model's constraints; show assumptions and distinguish the alternative of maximizing modeled benefit under a budget.

## National overview

Show a Kenya county exposure map with all 47 named and coded counties and a synchronized searchable list. The map displays synthetic funding/planning exposure only; a legend uses labels and patterns as well as color. Selection displays the county name, code, synthetic budget and release indicators, source period and a link to assumptions. Kisumu alone offers **“Explore Kisumu pilot”**; other counties say **“Planning overview only; facility simulation is not available.”** Do not use invented boundary geometries: show the list and an explicit map-unavailable state until a reviewed, licensed boundary adapter is configured. Do not infer facility stockouts for other counties.

## Kisumu overview and scenario

Show a breadcrumb from Kenya to Kisumu, the synthetic scenario selector, budget ceiling and an obvious **“Run 40% logistics shock”** action. Results show the first modeled stockout and its synthetic facility, sub-county, commodity and modeled timing, followed by an ordered list and a sub-county roll-up. Make the assumptions, run version and input provenance available beside the result. Funding-flow cards show approved, released, procured and delivered stages and age without implying that a generated bottleneck occurred in reality.

The action list compares modeled emergency procurement, reorder timing and eligible redistribution. Show cost and the selected target, the chosen set, cut line, exclusions and their reasons. Explain that available inventory, costs, routes and timing are assumptions, that donor protection is conservative, and that independently replayed first-stockout deferrals are not validated impacts. If no candidate meets the target under the ceiling, show **“No supplied option meets this synthetic target within the budget.”**

## Sub-county and facility detail

List the seven named Kisumu sub-counties and their synthetic facility counts and modeled risk; the roll-up must equal its underlying facility records. A selected sub-county opens a filterable list of synthetic facilities, grouped by level, with stock and consumption status, modeled stockout timing and funding context. A facility view identifies the synthetic facility and commodity, shows opening stock, consumption, delivery schedule and the assumptions behind the result, and offers an eligible modeled action where available. Make the planted chronic-stockout case, near-expiry surplus and at-risk neighbor, and stalled release discoverable with a **“Demo case”** label. Never display these as real facilities or events.

## Three-minute demo path

1. On the national overview, select **Kisumu** and explain that the national map shows synthetic funding/planning exposure; no other county has facility simulations.
2. Run the preselected **40% donor logistics support reduction** with the visible budget and protection target. Show the first modeled stockout and the affected synthetic facility and commodity.
3. Open its sub-county and facility, then compare the solver-selected lowest-cost feasible action with excluded options. Show the nearby surplus example and donor, distance and shelf-life constraints.
4. Open the stalled synthetic cash-release trace and end on the assumptions and limitations panel.

## Responsive behavior and states

At mobile widths (360–767 px), use bottom navigation, a full-screen map sheet with a bottom drawer, stacked funding cards and facility cards, and a sticky primary action that does not obscure content. At tablet widths (768–1023 px), place the map above a collapsible county list and use two-column cards where space permits. At desktop widths (1024 px and above), use side navigation, a map/list split view and sortable tables with visible row labels. Preserve 44 px touch targets, keyboard operation, reduced-motion preferences, light/dark themes and no horizontal page overflow.

Every view supports these states with retry or recovery where applicable:

| State | National overview | Kisumu, sub-county and facility views |
| --- | --- | --- |
| Empty | “No counties match these filters.” Clear filters. | “No synthetic records match these filters.” Clear filters. |
| Loading | “Loading synthetic county planning data…” | “Loading synthetic records…” or “Running illustrative scenario…” |
| Error | “County planning data is unavailable.” Retry; keep the accessible list if the map alone fails. | “This synthetic result is unavailable.” Retry and preserve entered scenario assumptions. |
| Offline | “Offline. Showing saved synthetic planning data, if available.” Mark its age. | “Offline. Showing saved synthetic results, if available.” Disable server-only actions. |
| Partial | “Some county planning inputs are unavailable.” Identify affected counties and do not treat missing values as zero. | “Some synthetic records or funding stages are unavailable.” Identify omissions and do not calculate misleading totals. |
| No map | “County boundaries are unavailable; use the county list.” | “Facility map unavailable; use the facility list.” |
| No result or mitigation | “No exposure result has been run.” | “Run a synthetic scenario to see results.” If no eligible mitigation exists, explain the constraint and allow target or budget revision. |
| Unauthorized | “You do not have access to this county.” | “You do not have access to these synthetic records.” Do not reveal other counties' details. |

Use English strings structured for later Swahili translation; all map symbols and risk badges have text alternatives. The national overview is a planning-level view only. Facility-level drill-down is limited to authorized Kisumu users.
