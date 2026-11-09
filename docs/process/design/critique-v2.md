# Critique: Kisumu v2 preview (baseline)

Run on 2026-11-08 against `docs/design/prototype/kisumu-v2/index.html` as committed in `42350cd`. Score: **20/40 (Acceptable)**, 0 P0, 3 P1. Copied from `.impeccable/critique/2026-11-08T16-09-58Z__docs-design-prototype-kisumu-v2-index-html.md`.

Method: dual-agent (A: design-review sub-agent · B: detector + browser sub-agent; browser loaded via file:// because sandboxed Chromium could not reach a local server; detector overlay ran in-page)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | "Rank feasible actions" beside already-ranked results; unclear if current |
| 2 | Match System / Real World | 2 | Codes, "Crit", "modeled days deferred", fixture term "Planted transfer" |
| 3 | User Control and Freedom | 2 | No reset; compare toggle hard-labelled "40% shock" |
| 4 | Consistency and Standards | 2 | Tab 209 vs headline 211; facility named three ways; cluster encoding switches |
| 5 | Error Prevention | 2 | Budget field has no min/max; shock slider free-runs while data exists for 0%/40% |
| 6 | Recognition Rather Than Recall | 2 | Codes on fix cards; legend apart from map |
| 7 | Flexibility and Efficiency | 2 | Table capped at 12 rows; sort not wired |
| 8 | Aesthetic and Minimalist Design | 2 | "Synthetic" repeated 6+ times; template card grids |
| 9 | Error Recovery | 1 | No loading/failed/nothing-fits states |
| 10 | Help and Documentation | 2 | No explanation of transfer vs emergency; no tour entry |
| Total | | 20/40 | Acceptable |

## Design Specificity Verdict
Content is product-specific; frame is generic admin dashboard (~60%). Authored pieces (timeline readout, "X of N out" clusters, cut line, unfunded reasons, "Stalled here") are demoted below generic KPI cards and behind tabs. Detector: 3 CLI findings (side-tab ×2 on .detail styles.css:493, cramped-padding on .tabs styles.css:340); overlay: unbalanced-heading ×4 and nested-cards on Fixes, first-viewport-column-overflow on Facilities. axe: color-contrast 4.4:1 on .fix--cut .reason (light, 5 nodes) caused by opacity 0.85; region on .banner (moderate).

## Priority Issues
- [P1] Lead question not answered on first screen → verdict line from backend fields; fixes beside map on desktop, first on mobile. /impeccable layout
- [P1] Misleading numbers: deferred days capped by the 90-day horizon (counterfactual null → "no stockout within 90 days"); 209 vs 211; day-41 headline vs list starting at day 1 (pre-shock shortages unlabelled); no-shock readout still "of 211"; hard-coded costs/bar widths. /impeccable clarify
- [P1] "Synthetic" repeated against brief → banner only; title "Kisumu"; "Facility 031". /impeccable distill
- [P2] Flat grid of 8 fix cards; budget control far from cut line → pair options per stockout; slider above budget bar; slim rail. /impeccable distill
- [P2] Map weak at timeline peak (3 blobs, worst-wins red at day 0, encoding switch, unlabelled circle, legend below fold, readout not live, reason contrast 4.4:1). /impeccable harden

## Persona Red Flags
Jordan: no answer sentence; day-41 vs day-1 conflict; jargon; toy costs; fixes in tab 3; no tour entry.
Sam: non-descriptive map label; inert cluster buttons; tabs not activated by arrows, no Home/End; glyphs read aloud; readout not live; 39×17 breadcrumb; 4.4:1 reasons.
Alex: compare only none vs 40%; 12-row table; dead sort; "… 201 more"; clipped column at 1280.
County planner: fixes buried on 390; hidden-scrollbar tabs; unnamed commodities; no sub-county roll-up; no Swahili; funding not tied to stockouts.

## Minor Observations
Copy link wraps at 1280; cut-line label clipped at 390; funding step numbers read as amounts; detail always F031; clusters don't follow theme; tabs bottom border no inset; unbalanced fix titles; "stockouts" undefined.

## Questions to Consider
- What single sentence should a judge repeat after 10 seconds, and why is it not on the page?
- Should the budget slider live in the Fixes view so the cut line moving is the delight?
- Is the map earning the hero spot at Kisumu scale, or should a "what breaks first" strip lead?

