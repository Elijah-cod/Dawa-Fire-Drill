# Case study: Dawa Fire Drill

## The question

When donor logistics support for essential medicines is cut, a county health planner needs to answer: *what breaks first, and what is the cheapest fix within the budget?* Dawa Fire Drill is a sandbox for rehearsing that answer on an invented Kenyan county before it matters. It is not a monitoring system and not a government system, and every number in it is synthetic.

## Constraints I set

- **Synthetic data only**, anchored to public aggregates for scale (facility mix, lead times, demand and funding totals) and labelled everywhere. No accuracy, impact or adoption claims.
- **The optimizer decides.** OR-Tools ranks mitigations; language models may only extract bin-card fields and restate the optimizer's result.
- **Reproducible results.** Versioned, seeded generators and a versioned, deterministic simulator, so a figure in the UI can be traced to a seed and version.
- **Built for county settings.** Works on a 390 px phone, in English and Swahili, without relying on colour alone, with keyboard support and accessibility checks.

## What I built

- A FastAPI backend with Postgres (row-level security for country tenancy, an immutable snapshot store and a lease-fenced run queue), Neo4j for the funding trace, OR-Tools for ranking and a provider abstraction for language-model extraction and explanation.
- A Next.js frontend with a national schematic grid and a Kisumu pilot page that leads with a verdict, then lets the planner change the shock, scrub the 90-day timeline, move the budget and inspect facilities, funding and capture.
- A local demo session (`scripts/demo-up.sh`) that mints a short-lived synthetic token kept only in the web server's environment, and a static read-only build that uses bundled fixtures.

## What the demo shows

At a 40% cut in donor logistics support (seed 42, county generator v5): 209 stockouts caused by the shock, first at Tamarind Crossing Sub-County Hospital (Kisumu West) for family planning tracer 04 on day 41; 2 more at facilities already short before the shock, shown separately. The optimizer's options cover only the 4 earliest stockouts, and the page says so. At 30 illustrative units it funds 3 transfers and cuts the fourth; at 100 it funds all 4 for 40 units; at 5 nothing fits. At a 100% cut no transfer can arrive in time (arrivals from day 39, stockouts by day 26), and the page states that instead of showing an empty list. One synthetic funding flow shows 100,000 KES approved and not released after 90 days.

## Decisions and tradeoffs

- **Answer first.** A design review of an early version found a dashboard of panels with no lead. The redesign puts one sentence at the top that answers the question, with the supporting numbers one click away. Tradeoff: that sentence depends on a backend run, so `/kisumu` page load scores 0.73–0.75 in Lighthouse against a 0.80 budget; the gap is documented rather than hidden.
- **Honesty over polish.** The UI keeps pre-existing shortages apart from shock-caused ones, labels costs as illustrative units rather than shillings, says when fixes cover only part of the problem, and shows loading, in-flight, failed and offline states explicitly.
- **No broker.** A Postgres-backed queue with lease tokens was enough for planning workloads and kept queue state transactional with the data.
- **Schematic, not a boundary map** for the national view, because boundary data rights were unresolved.

## How it was checked

Measured on the final code: 162 web unit and component tests, 154 backend tests (86% line coverage), 112 Playwright tests across four viewport widths with axe accessibility checks and a token-leak canary, Lighthouse 1.00 on the overview and on the interaction flow, and gitleaks over the full history with no findings. Architecture decisions are recorded in [`docs/adr/`](adr/).

## How it was built

I designed the product, set its rules and reviewed every change. AI coding agents implemented much of the code under my direction, in small commits with tests in each change; the working notes are in [`docs/process/`](process/).

## What I would do next

Generate candidates for more than the earliest stockouts, reuse completed runs so the verdict appears faster, add production sign-in and an offline capture queue, and get the Swahili strings reviewed by a native speaker.
