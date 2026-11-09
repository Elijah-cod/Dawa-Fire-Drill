# 0002: The optimizer decides; AI only explains

**Status:** accepted

## Context

Ranking mitigations under a budget is a constrained selection problem: options have costs, a cheaper option can make another redundant, and donors cannot give away stock they need. A language model asked to "pick the best fixes" can produce fluent but unverifiable or inconsistent answers, which is unacceptable for a planning tool even with synthetic data.

## Decision

OR-Tools selects the funded set (`dawa_api.optimization`), maximizing modeled days deferred within the budget subject to donor protection, budget and mutually exclusive action constraints. Every excluded option carries a machine reason (for example `remaining_budget_exceeded`, `cost_exceeds_ceiling`, `alternative_selected`). Language models are allowed two jobs only: extracting bin-card fields from a photo, which a person must confirm, and restating an optimizer result in plain language. Their output never feeds back into a ranking. The default explanation is a deterministic template; the UI shows it behind "Why these picks?" with a one-sentence summary derived from the ranking data.

## Consequences

- Rankings are reproducible and testable (recorded rankings are fixtures for the web tests).
- Explanations are plain and English-only, and are marked as such in Swahili mode.
- Any change in model provider cannot change a decision.
