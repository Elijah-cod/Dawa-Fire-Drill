# Phase 1 design brief

## Intent and boundaries

Dawa Fire Drill helps a county planner rehearse a supply shock, see the sequence of illustrative stockouts, and choose feasible mitigations under a budget. District pharmacists inspect facility consequences and redistribution options. Facility staff confirm bin-card extraction before stock records are saved. The first-run demo should reach a ranked action in three minutes.

All displayed records are **synthetic, calibrated to public aggregates**. Predictions and optimization outputs are **illustrative and unvalidated**. No screen may imply operational accuracy or a verified impact estimate. OR-Tools/PuLP ranks actions; the explanation panel only restates that result. The UI never asks the LLM to choose an action.

No frontend product code begins until `DESIGN APPROVED` is recorded in `APPROVAL.md`. This design is for review, not an implementation authorization.

## Design direction

An operations desk: off-white canvas, deep ink text, teal primary action, restrained amber and red risk accents. The first screen foregrounds one next step, “Run a scenario,” and a visible “Try the 3-minute demo” path. Numbers carry units, date ranges, and synthetic labels. A map supports spatial inspection but never hides the ranked list.

## Files

Design mockups may use the two shock magnitudes supplied by the user (40% logistics support drop and 45-day cash delay). Any other numeric stock, site, risk, cost, or impact value remains a labeled placeholder until a synthetic dataset is generated and its calibration assumptions are documented. Do not treat Figma-generated sample figures as calibrated project data.

- [Roles and flows](roles-and-flows.md)
- [Screen specifications](screens.md)
- [Tokens and accessibility](tokens.md)
- [Components and responsive rules](components-and-responsive.md)
- [String plan](strings.md)
- [Figma build checklist](figma-checklist.md)
- [Static responsive prototype](prototype/README.md)
- [Checkpoint A review checklist](REVIEW.md)
