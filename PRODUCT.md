# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **County health planners** (national and Kisumu county roles in the demo): choose a supply shock, see which facilities and medicines run out first, and pick the fixes that fit a budget.
- **District pharmacists**: inspect facility consequences and redistribution options, including shelf life and availability.
- **Facility in-charges**: upload a bin-card photo and confirm every stock field before anything is saved.
- **Hackathon judges**: watch a guided three-minute demo and must understand what breaks first, why, and the cheapest fix without help.

Audience priority when needs conflict: not yet stated. Inferred from the success answer below: the demo path leads for now, built on the planner's real task rather than a separate show mode. Confirm.

## Product Purpose

Dawa Fire Drill is a supply-chain stress-test simulator for essential medicines in Kenya, built with country adapters for later expansion. A planner picks a shock scenario (for example a cut in donor logistics support or a cash-release delay), sees the order in which facility–commodity pairs stock out, traces where funding is delayed, and gets the cheapest feasible fixes under a budget ceiling.

Success for the next milestone (confirmed): **both, demo first.** The three-minute demo must land: a judge can say what breaks first, why, and the cheapest fix unaided. Every choice should stay compatible with a later real pilot in one county once real data replaces the synthetic panel.

## Positioning

Inferred from the repository's agent rules and implementation; confirm which points to lead with:

- **The optimizer decides; AI only explains.** OR-Tools ranks mitigations. LLMs only extract bin-card fields and restate optimizer results; LLM output never changes a ranking.
- **Order of failure, not totals.** The product shows which facility and commodity run out first under a chosen shock.
- **Cheapest fix under a budget.** Transfers are ranked against emergency orders within a ceiling, with a visible cut line and the reason each option is or is not funded.
- **Money-to-medicine trace.** Funding stages (approved, released, procured, delivered) are linked to the stockouts they cause.

## Operating Context

- Kenya's 47 counties appear on a schematic grid (not a boundary map, because boundary data rights are unresolved). Kisumu is the only facility-level pilot: 40 invented facilities in seven sub-counties, 10 tracer commodities, a 90-day simulation horizon.
- The demo runs locally through `bash scripts/demo-up.sh` (production build, synthetic token, role switching between national planner, Kisumu planner, pharmacist and facility roles) and includes a guided seven-step tour.
- Planners use it to rehearse decisions, not to operate a live supply system.

## Capabilities and Constraints

- Shipped: shock scenarios with a stockout summary and full order, risk map with clusters and counts, ranked fixes with budget cut line and exclusion reasons, funding stage trace, online-only bin-card capture with human confirmation, guided demo, English and Swahili, light and dark themes.
- Only data the backend already provides may be shown; no invented figures or modeled effects. Risk cutoffs (Critical ≤45 days, Watch 46–52, Stable >52) were tuned for readability of this synthetic scenario relative to the 90-day horizon and are not a standard.
- Undecided or not built: production sign-in, offline capture queue, Scenarios / Actions / Stock destinations, real data sources, real extraction provider.
- Stack is fixed by the codebase: Next.js App Router with strict TypeScript and CSS-variable tokens on the frontend; FastAPI, Postgres, Neo4j and OR-Tools on the backend. No heavy UI or animation libraries.

## Brand Commitments

Stated by the user as binding:

- Tone: calm, trustworthy, clear, modern and institutional, with a few moments of delight (the timeline, the budget slider). Not flashy health-tech and not a generic AI dashboard.
- Keep the existing deep teal/green brand. A restrained status system (Critical, Watch, Stable, Unknown), each with a symbol as well as a colour.
- Avoid: purple gradients, glassmorphism, emoji as icons, identical card grids, heavy shadows, decorative animation.
- Synthetic, illustrative data is stated clearly once and prominently, without repeating “synthetic” on every item.

## Evidence on Hand

- All data is synthetic and illustrative: county generator version 5, seed 42, calibrated only to public aggregates documented in `docs/data-assumptions.md`. Model outputs are unvalidated.
- Demo facts (seed 42, 40% logistics shock): 211 stockouts against 2 with no shock, 209 caused by the shock; first stockout SYN-KE-042-F031 · SYN-C04 on day 41; 10 Critical, 18 Watch, 12 Stable facilities; at 30 KES three transfers are funded and the fourth is cut by the remaining budget.
- There are no real users, testimonials, pilots, deployments, accuracy figures or impact results. None may be implied.

## Product Principles

1. Truth before polish: every number on screen comes from the backend or is clearly labeled as an assumption; outputs are illustrative and unvalidated.
2. Show what breaks first, then what to do about it.
3. The optimizer makes the decision; explanations only restate it.
4. One product, one path: the demo is a guided route through the real planner task, not a separate show.
5. Built for county settings: works on a phone, in two languages, without relying on colour alone.

## Accessibility & Inclusion

WCAG 2.1 AA; 44 px minimum touch targets; mobile-first; English and Swahili (Swahili strings awaiting native-speaker review); light and dark themes; reduced-motion support; status never conveyed by colour alone; Lighthouse performance at or above 0.80.
