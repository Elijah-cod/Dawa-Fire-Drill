# Figma build and review checklist

Target file: **Dawa Fire Drill — Phase 1 Design**. Create pages **Foundations**, **Components**, **Screens**, and **Prototype**. The file is a review artifact; `DESIGN APPROVED` remains the implementation gate.

## Foundations

- [ ] Light and dark palettes with named semantic tokens from `tokens.md`
- [ ] Type scale, spacing, radius, elevation, and motion notes
- [ ] Risk semantics with text, icon, and pattern; contrast annotations
- [ ] Synthetic-data banner and illustrative-output disclaimer

## Components

- [ ] Buttons, fields, slider with numeric input, budget control, risk badge
- [ ] Action card, stockout timeline, map/list pair, trace stage, stock table/card
- [ ] Capture preview, offline queue, dialog/sheet, status/toast
- [ ] Focus, disabled, loading, empty, error, offline, and partial-data variants

## Screens

- [ ] Overview, scenario setup, progress, results, actions, funding trace, stock risk, redistribution, capture, facility detail
- [ ] Each key screen at mobile 390, tablet 768, desktop 1280; verify 360, 1024, 1536 behavior in notes
- [ ] Light and dark example for at least Overview, Results, and Capture
- [ ] Mobile map sheet and table-to-card transformation
- [ ] Exact copy and synthetic notice match `screens.md`

## Prototype

- [ ] Clickable path: Overview → scenario setup → progress → results → actions → action detail
- [ ] Clickable path: Stock → facility → capture → review → confirm → offline queue
- [ ] Back, cancel, confirmation, and undo behavior
- [ ] Keyboard and focus-order review notes

## Review questions

1. Can a planner find and complete the three-minute demo without instruction?
2. Is the optimizer’s ordered choice and budget cut line unambiguous?
3. Can a district pharmacist tell a feasible transfer from an excluded one?
4. Can a facility in-charge correct every extracted bin-card field before save?
5. Are synthetic and unvalidated notices visible at every decision point?
6. Do risk and status remain understandable without color or motion?
