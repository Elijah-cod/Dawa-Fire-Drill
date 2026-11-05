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

## Phase 1: Design — in progress

### Completed locally

- Created local branch `phase/1-design` from the Phase 0 foundation.
- Wrote roles/jobs, information architecture and flows, exact screen copy with empty/loading/error/offline/partial states, design tokens, components, responsive behavior, string plan, and Figma checklist in `docs/design/`.
- Checked proposed light and dark text/color pairs against WCAG contrast calculations; all listed primary text pairs exceed 4.5:1.
- Created the Figma file and its Foundations, Components, Screens, and Prototype pages. Three editable Overview frames at 390×844, 768×1024, and 1280×800 were generated and visually inspected on the Prototype page. The generated examples contain placeholder quantities that need removal or explicit calibration before approval. Scenario, Results, and Actions frames are generating on the Screens page.

### Verification and next

- Local verification after the documentation batch: `git diff --check` and a design-file/state checklist passed; API `6 passed` with the known upstream warning, Ruff and mypy passed; web lint, typecheck, Vitest tooling command, and Prettier passed. Vitest has no product tests because there is no frontend product code.
- Inspect generated Figma frames, correct ungrounded example quantities and risk labels, fill missing design pages and prototype interactions, then run the design review checklist.
- Stop at Checkpoint A. Frontend implementation requires the exact reply `DESIGN APPROVED` and an entry in `docs/design/APPROVAL.md`.
