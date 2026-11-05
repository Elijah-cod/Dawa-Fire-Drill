# Progress

## Phase 0: Foundations — in progress

### Completed locally

- Recorded the full project rules in `AGENTS.md`, including the design gate and no agent contributor credit.
- Split the original root environment template by reader into `apps/api/.env.example` and `apps/web/.env.example`.
- Added the monorepo directories and secret-file ignore rules.
- Added the Python 3.12 API package, dependency lockfile, and typed settings. `DATABASE_URL` is required and its validation error names the environment variable.
- Added `/health`, Docker Compose for API/Postgres/Neo4j, a Python Dockerfile, web tooling configuration and lockfile, pre-commit hooks, and PR CI jobs. No frontend product screens were implemented.

### Verification and blockers

- Environment inspection: Python 3.12.14 is available through `uv`; Node 24.21.0 and Docker CLI 29.8.2 are installed. The Docker daemon is not running. `gh` is not installed.
- API result after the health endpoint: `6 passed` on Python 3.12.14, with one upstream Starlette deprecation warning; `ruff check .`, `mypy dawa_api`, Bandit, and pre-commit hooks passed. Current API module coverage was 100% in this narrow test run.
- `docker compose -f infra/compose.yaml config --quiet` passed. The Docker daemon was initially unavailable.
- Docker Desktop started. `docker compose -f infra/compose.yaml up -d --build` completed, Postgres became healthy, and `curl --fail http://localhost:8000/health` returned the documented synthetic-data notice. The test containers were stopped with `docker compose down`.
- Web tooling: after adding active TypeScript ESLint rules and a patched `minimatch` override, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run format:check` exited 0. Vitest found no tests because frontend implementation is gated. `npm audit --audit-level=low` found zero vulnerabilities.
- Python security: Bandit passed. `pip-audit` found a vulnerable pytest 8.4.2, so the lockfile was updated to pytest 9.2.0. A fresh `pip-audit` found no known vulnerabilities; it skipped the local `dawa-api` package because it is not published to PyPI.
- A local pre-commit run passed both Ruff and mypy hooks. GitHub Actions CI has not run.
- The user has directed that nothing be pushed until they are ready for production. Do not push, open a PR, or merge without explicit authorization. Earlier GitHub host resolution failures no longer block local work.
- The local Phase 0 checks passed. The publication gate (PR and CI) remains pending by user choice.

### Next

1. Continue Phase 1 design locally on its own phase branch, respecting the design review checkpoint.
2. Keep commits local. When the user explicitly authorizes publication for production, push phase branches, open PRs, and verify every CI job before merge.

## Phase 1: Design — approved; native Figma canvas incomplete

### Completed locally

- Created local branch `phase/1-design` from the Phase 0 foundation.
- Wrote roles/jobs, information architecture and flows, exact screen copy with empty/loading/error/offline/partial states, design tokens, components, responsive behavior, string plan, and Figma checklist in `docs/design/`.
- Checked proposed light and dark text/color pairs against WCAG contrast calculations; all listed primary text pairs exceed 4.5:1.
- Created the Figma file and its Foundations, Components, Screens, and Prototype pages. Figma AI reached the team's daily credit limit. Its generated frames contained unsourced quantities and costs; those frames were removed rather than presented as calibrated data. Native Figma frames and prototype connections remain missing. No billing or plan setting was changed.
- Built a static HTML/CSS review prototype for all ten key screens and the mobile map sheet in `docs/design/prototype/`, with placeholders instead of invented domain figures. It is design material only; no frontend product code exists.

### Verification and next

- Local verification after the documentation batch: `git diff --check` and a design-file/state checklist passed; API `6 passed` with the known upstream warning, Ruff and mypy passed; web lint, typecheck, Vitest tooling command, and Prettier passed. Vitest has no product tests because there is no frontend product code.
- Prototype responsive check passed 66 view/width combinations at 360, 390, 768, 1024, 1280, and 1536px, including no horizontal overflow, visible synthetic banner, one heading per view, labeled controls, and navigation mode. Two dark-theme checks passed. Overview, Results, and Capture screenshots were generated at the four required test widths and visually inspected at mobile and desktop. The Checkpoint A checklist is in `docs/design/REVIEW.md`.
- Final local checks after the prototype: API 6 passed with the known upstream warning, Ruff and mypy passed; web ESLint, TypeScript, Vitest tooling command, and Prettier passed. `git diff --check` and internal prototype link checks passed. CI has not run because the user has withheld publication.
- On 2026-11-05 the user replied `DESIGN APPROVED`; the reviewed artifacts and remaining Figma limitation are recorded in `docs/design/APPROVAL.md`.
- Continue with Phase 2 backend work on a local phase branch. Stop at Checkpoint B for backend review.

## Phase 2: Backend — in progress

- Added initial deterministic daily stock-flow and OR-Tools budget-constrained selection primitives, with example and property tests. These are illustrative and unvalidated, and do not yet provide the required persisted scenario runs or ranked mitigation API.
- Final local Python check for this unit: 10 tests passed with one upstream Starlette warning; Ruff and mypy passed.
- Remaining scope includes country adapters and synthetic seed, persistence and migrations, finance trace, complete simulation and ranking, forecasting, redistribution, capture and explanation providers, jobs, authentication, operational endpoints, and integration tests. Checkpoint B has not been reached.
- Added initial funding-stage diagnostics, moving-average baseline, and redistribution constraint services. The local suite passed 15 tests with one existing upstream warning; Ruff and mypy passed after correcting a lint finding. Funding ageing currently uses a single supplied record date, and all three services still need persistence, API integration, and expanded validation.
- Added a Kenya configuration loader and an explicit non-operational second-country stub. The local suite passed 18 tests with the existing warning; Ruff and mypy passed. No synthetic dataset has been generated or calibrated yet; source and calibration TODOs are recorded in `docs/data-assumptions.md`.
- Added a country-filtered Postgres scenario repository with atomic idempotency and pagination, plus an Alembic migration. The full local Python suite passed 20 tests, including isolated Postgres migration up/down and repository integration tests; Ruff and mypy passed. Database row-level security, auth, and API routes remain outstanding; repository filtering alone is not a complete tenancy boundary.
