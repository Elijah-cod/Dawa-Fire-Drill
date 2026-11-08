# Critique: Kisumu v3 preview

Run on 2026-11-08 against `docs/design/prototype/kisumu-v2/index.html` as committed in `b6b1965`. Score: **24/40 (Acceptable)** against the 20/40 v2 baseline in [critique-v2.md](critique-v2.md); 1 P0, 3 P1. Screenshots: `docs/design/prototype/kisumu-v2/screenshots/v3/` (`order-40.png` shows the 197 undercount found here).

Method: dual-agent (A: design-review sub-agent · B: detector + browser sub-agent; page loaded via file://, detector overlay ran in-page)

## Design Health Score (v3 vs v2 baseline)
| # | Heuristic | v2 | v3 | v3 key issue |
|---|---|---|---|---|
| 1 | Visibility of System Status | 3 | 2 | In-flight state already shows the new funded set; re-render drops focus |
| 2 | Match System / Real World | 2 | 2 | Medicines only as codes; "planted"; "transfer-1" in explanation |
| 3 | User Control and Freedom | 2 | 2 | Slider drag stalls; Compare duplicates 0% preset; rows look clickable, do nothing |
| 4 | Consistency and Standards | 2 | 2 | Order badge 209 vs list 197; map uses selected day, area list whole run |
| 5 | Error Prevention | 2 | 3 | Presets limited to real runs; number field snaps per keystroke |
| 6 | Recognition Rather Than Recall | 2 | 2 | Markers lack area names |
| 7 | Flexibility and Efficiency | 2 | 2 | URL state, week steps; inert sort |
| 8 | Aesthetic and Minimalist Design | 2 | 3 | Calm; long uniform fixes stack |
| 9 | Error Recovery | 1 | 3 | Failure keeps last ranking and offers Try again |
| 10 | Help and Documentation | 2 | 3 | Single banner, About, legend; no first-run cue |
| Total | | 20/40 | 24/40 | Acceptable |

## Design Specificity Verdict
Content is specific (data-built verdict, transfer-vs-emergency pairs with optimizer reasons, cut line, "modeled, no intervention" scrubber); visual layer still generic admin UI. Detector: cramped-padding on hidden .about (styles.css:182) and on .tabs (styles.css:387); cream-palette (suppressed: approved off-white brief). Overlay: straggler in map intro p.sub at 1280; nested-cards on #compare and #map (false positives) and on facility detail panel (real, with 2px top accent on rounded corner). axe: no serious/critical in 10 states; no overflow; no sub-44px targets; markers never overlap; all contrast ≥ 5.66:1.

## Priority Issues
- [P0] Budget slider rebuilt on every input: drag stalls, focus drops, number field snaps per keystroke. Render control once, update bar/status/pairs; snap on blur/Enter. /impeccable harden
- [P1] Order list drops all events at already-short facilities (197 shown vs 209 shock-caused; confirmed). Exclude only pre-shock/no-shock events by facility+commodity+day. /impeccable harden
- [P1] Medicines invisible (SYN-C04); backend provides commodity name/category but export drops it. /impeccable clarify
- [P1] Verdict/fixes don't land payoff; unfunded pair wording reads as outcome; 100% is a grey dead end with "planted"; explanation shows transfer ids. /impeccable clarify
- [P2] Map doesn't carry the story: unnamed markers, area list on whole-run status, dark some/all out both pink, mild default day. /impeccable layout
Also: Funding Procured/Delivered zeros hard-coded in app.js; "Already short before the shock" also covers the no-shock-run facility (F003).

## Persona Red Flags
Jordan: codes, "planted", "transfer-1", Compare compares nothing, 100% dead end, no cue to play/move budget.
Sam: focus loss after budget change; no skip link; non-focusable clickable rows; dark some/all out colour-only.
Alex: inert sort; no area/commodity filter; 8 options always expanded.
County planner: "Stable" beside day-53 stockouts; funding not linked to stockouts.

## Minor Observations
Scenario meta repeats verdict; developer-note hint; 209 vs 211 unexplained in facts; mobile controls push results below fold; budget-bar segment labels redundant.

## Questions to Consider
- Does the map earn the hero slot, or should a ranked "what breaks first" list with the cut line lead?
- Should 100% shock be the demo's most honest moment ("no transfer can arrive in time") rather than an empty state?
- Should "Stable" exist for a facility that runs out on day 53 of 90?
