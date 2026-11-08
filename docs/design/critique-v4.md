# Critique: Kisumu v3 preview after fixes and display face

Run on 2026-11-08 against `docs/design/prototype/kisumu-v2/index.html` as committed in `ac623fb`. Score: **25/40 (Acceptable)**, against 20/40 for v2 ([critique-v2.md](critique-v2.md)) and 24/40 for v3 before fixes ([critique-v3.md](critique-v3.md)). Findings: 0 P0, 3 P1. Screenshots: `docs/design/prototype/kisumu-v2/screenshots/v4/`.

Method: dual-agent (A: design-review sub-agent · B: detector + browser sub-agent; preview served on localhost, detector overlay injected in-page on six views).

## Design Health Score
| # | Heuristic | v2 | v3 | v4 | v4 key issue |
|---|---|---|---|---|---|
| 1 | Visibility of System Status | 3 | 2 | 3 | In-flight line works; loading state's verdict already states the 30 KES result |
| 2 | Match System / Real World | 2 | 2 | 2 | 10–50 KES fixes and a 100 KES budget beside a 100,000 KES funding flow; "Stable" beside day-53 to day-81 stockouts |
| 3 | User Control and Freedom | 2 | 2 | 3 | Everything reversible and in the URL; Compare is a run toggle |
| 4 | Consistency and Standards | 2 | 2 | 2 | Map follows the day, area list does not; at 0% Compare shows the same run twice |
| 5 | Error Prevention | 2 | 3 | 3 | Number field snaps silently (37 → 35, 500 → 100) |
| 6 | Recognition Rather Than Recall | 2 | 2 | 3 | Verdict restates results; status cutoffs unexplained |
| 7 | Flexibility and Efficiency | 2 | 2 | 2 | No skip link; facility rows not selectable |
| 8 | Aesthetic and Minimalist Design | 2 | 3 | 2 | Four never-funded emergency options and a long optimizer paragraph always shown |
| 9 | Error Recovery | 1 | 3 | 3 | Failure keeps last ranking; pinned failed copy names the same budget twice |
| 10 | Help and Documentation | 2 | 3 | 2 | About is good; "transfer", "tracer 04", cutoffs unexplained |
| Total | | 20/40 | 24/40 | 25/40 | Acceptable |

## Design Specificity Verdict
Mostly specific: a serif verdict sentence answers "what breaks first" instead of KPI tiles; budget bar with cut line, transfer-vs-emergency pairs with reasons, "Stalled here" funding stage. Generic: bordered three-column panels and a bubble map that duplicates the area list.

Detector: CLI clean with project config; without it, `cream-palette` (approved off-white brief) and `cramped-padding` on `.tabs` (underline-on-rule pattern), both suppressed. Overlay: nested-cards on `#compare` (segmented control, false positive) and `#map` (arguable); stragglers in `p.hint` ("demo." alone) and the 390 px verdict ("41." alone), plus trailing numbers in data rows (low value). axe: 21 of 22 runs clean; `scrollable-region-focusable` (serious) on `.table-wrap` in Facilities at 390 px. No page overflow at 390; two tabs off-screen in a scroll strip with no cue. No targets under 44 px. Contrast: 0 fails light or dark (lowest 5.66:1). Font loads locally; only host contacted was localhost. Layout shift during budget and timeline interaction: 0.

## Priority Issues
- [P1] Fixes cover 4 of 209 shock-caused stockouts and the page never says so; 100 KES reads as "fixed". Add coverage to the verdict or fixes header. /impeccable clarify
- [P1] Cost scale: 10–50 KES fixes and a 100 KES budget next to a 100,000 KES funding flow undermine trust. Label units as illustrative cost units or bring costs to a believable scale (backend decision). /impeccable clarify
- [P1] Loading state contradicts itself (verdict states the result while fixes say Loading); failed state has no `budget-status` id so the slider's `aria-describedby` dangles. /impeccable harden
- [P2] Facilities tab: rows not selectable, detail panel far below; table region not keyboard-scrollable at 390. /impeccable layout
- [P2] Area list ignores the selected day; mobile tab strip hides Funding and Facilities with no cue. /impeccable adapt

## Persona Red Flags
Alex: no skip link; rows inert; Copy link and CSV do nothing. Sam: timeline readout announces every step while playing; dangling describedby in failed state; table rows and table region not focusable. Jordan: "Stable" next to day 81; 0% says nothing to fix while facts show 2 Critical; "tracer 04", "Compare", "transfer" unexplained; teal bold numbers look like links. County planner: KES scale and generic tracer names break trust; funding trace not linked to stockouts; on mobile the first screen is all verdict text.

## Minor Observations
Reserved verdict height leaves a gap at 0%; cut list lacks "and"; budget control vanishes at 100%; legend copy awkward; one colour for 1/6 and 3/6 out; explanation repeats "illustrative and unvalidated"; sidebar background stops at 100vh in full-page captures.

## Questions to Consider
- If only 4 stockouts can be fixed at all, should the panel lead with what cannot be fixed?
- Does the map earn its space over a day-aware area list, given positions are invented?
- Should Compare be a side-by-side delta rather than a run toggle?
