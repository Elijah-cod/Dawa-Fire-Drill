# 0007: Illustrative cost units for fixes

**Status:** accepted

## Context

The ranked fixes compare a transfer (assumed cost 10) with an emergency delivery (assumed cost 50) under a budget (default 30). These numbers were labelled KES, next to a funding trace showing 100,000 KES. A design review found the mismatch undermined trust: a planner would read "30 KES" as a real price.

## Decision

Fix costs, the budget slider and field, the verdict's budget sentence and related text use "units (illustrative)", and the About panel says costs are not calibrated to real prices. The funding trace keeps KES because its amounts are scaled from a cited public aggregate. The backend and generator were not changed; the label is a presentation decision.

## Consequences

- The ranking logic and recorded rankings are unchanged; only the language is.
- Real prices would need an adapter and a calibration note before the units could become a currency.
