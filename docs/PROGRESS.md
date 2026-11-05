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
- A local pre-commit run passed both Ruff and mypy hooks. GitHub Actions CI has not run because the branch could not be pushed.
- GitHub host resolution failed on `git remote show origin` and the post-commit push. A prior escalated push request was rejected. Per the working agreement, the push has not been retried repeatedly. No PR or CI result is available.
- Phase 0 test gate has **not** passed. Do not merge or call this phase complete.

### Next

1. Push `phase/0-agent-rules` and open a PR once GitHub access is available; verify every CI job before merge.
2. Review the Phase 0 PR and the remaining foundation requirements before declaring the phase complete.
3. Begin Phase 1 design only after the Phase 0 PR and CI gate are reviewed.
