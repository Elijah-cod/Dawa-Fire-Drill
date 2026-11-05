# Dawa Fire Drill agent rules

## Product

Dawa Fire Drill is a supply chain stress-test simulator for health commodities in Kenya, designed to support more countries. Planners select shocks, such as a 40% drop in donor logistics support or a 45-day cash-release delay, and inspect the order of district and commodity stockouts and the cheapest mitigation within a budget ceiling. Planned capabilities include bin-card photo extraction, financing-flow trace, stockout forecasts, and redistribution suggestions.

## Non-negotiable rules

- Use **synthetic data only**, calibrated to public aggregates. Label synthetic data in the UI, README, and API docs.
- Treat model outputs as **illustrative and unvalidated**. Never state accuracy numbers.
- Use OR-Tools for optimization and ranking decisions. LLMs may only extract bin-card data and explain results; they must not rank mitigations.
- Keep secrets out of Git. Provide `.env.example`; keep API keys on the backend only.
- Do not invent data sources or URLs. When real data is needed, add a TODO and an adapter stub.
- Do not start frontend implementation until the user replies exactly `DESIGN APPROVED` in this repo. Record the approval in `docs/design/APPROVAL.md`.

## Git workflow

- Use one branch per phase, named `phase/<n>-<name>`, and open one PR to `main` per phase.
- Commit each logical unit with a Conventional Commit prefix: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, or `ci:`. Commit at least every 30–60 minutes of work.
- Run the relevant tests and lint before every commit. Push after every commit.
- Include `CHANGELOG.md` and relevant `docs/` updates in the same PR as code.

## Quality bar

- Backend: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, pytest, ruff, and mypy.
- Frontend, after design approval: strict TypeScript, Next.js App Router, ESLint, Vitest, and Playwright.
- GitHub Actions must run lint, type checks, and tests on every PR.
- End each phase with passing checks, updated documentation, and short demo notes in `docs/phases/<n>.md`.
