# CI risk: what is most likely to fail first

The workflow (`.github/workflows/ci.yml`) has four jobs: `secrets`, `api`, `web` and `docs-quickstart`. None of them has run on GitHub Actions yet. Everything below was checked locally on macOS (arm64); the runner is Ubuntu 24.04 (amd64). Ordered from most to least likely to fail on the first push.

1. **`web` → `npm audit --audit-level=low`** and **`api` → `uv run --frozen pip-audit`.** Both fail on any newly published advisory, even a low one, and query live advisory databases. Locally today: `npm ci` reported "found 0 vulnerabilities"; pip-audit last passed in the Phase 3 checks. If one fails, read the advisory: update the dependency and lock file, or record an accepted risk.
2. **`secrets` → gitleaks-action.** It needs `GITHUB_TOKEN` (provided) and, for repositories owned by a GitHub organization, a `GITLEAKS_LICENSE` secret; a personal-account repository does not need one. It scans the full history (`fetch-depth: 0`); locally gitleaks v8.30.1 found no leaks in the 212 commits at the start of this work. The action may use a newer gitleaks version with new rules.
3. **`web` → `npm run test:static-demo`.** First run on Linux of a script that builds the app, starts `next start` on port 3400 and drives Chromium. Possible problems: slower cold builds hitting the 30-second waits, or a missing system library (the job runs `npx playwright install --with-deps chromium` first). Locally it passes all 14 checks.
4. **`docs-quickstart`.** Builds the API image on the runner (`python:3.12-slim` is not pinned by digest; `uv sync` inside the image downloads packages), then waits for `/health` and `/ready` with `--retry-all-errors`, and seeds the country and county data. Most likely problems: a slow first build, or an upstream base-image change. On failure the job prints `docker compose logs`. The same commands passed in a fresh clone locally.
5. **`api` → pytest.** Uses the Postgres service at `localhost:5432` (digest-pinned `postgres:16`). Neo4j and Docker are faked in the tests, so neither service is needed. Locally: 154 passed. Timing-sensitive tests (lease expiry, rate limits) are the most likely to differ on a slower runner.
6. **Pinned versions.** Node `24.21.0` (setup-node), Python `3.12` and uv `0.12.21` (setup-uv) match the local toolchain. If a runner cannot fetch one of these exact versions, the setup step fails immediately with a clear message.
7. **`web` → `npm run test:design-prototype`.** Playwright against the static design prototype; it passes locally (66 screen/width combinations and 2 dark-theme checks). Low risk.
8. **`web` → lint, typecheck, format, Vitest; `api` → Ruff, mypy, Bandit.** Pass locally and are deterministic given the lock files. Low risk.

## Not covered by CI (known gaps)

- The Playwright browser suite (112 tests) and the Lighthouse flows need the full stack plus `scripts/demo-up.sh`, so they run only locally.
- No deployment job; the static demo is deployed by hand (`docs/deploy-demo.md`).

## Changes made in the review

- Actions pinned to commit SHAs: `actions/checkout` v4.4.0, `actions/setup-node` v4.4.0, `astral-sh/setup-uv` v6.8.0, `gitleaks/gitleaks-action` v2.3.9.
- `runs-on: ubuntu-24.04` instead of `ubuntu-latest`; workflow `permissions: contents: read`; a concurrency group.
- Node pinned to `24.21.0`; uv to `0.12.21` with Python `3.12`.
- `postgres:16` and `neo4j:5` pinned by digest in the workflow and in `infra/compose.yaml`.
- `gitleaks-action` given `GITHUB_TOKEN`.
- `docs-quickstart` also runs the county seeding step from the README, uses `--retry-all-errors`, and prints logs on failure.
- New step: `npm run test:static-demo`.
- `actionlint` 1.7.7 (Docker): no findings.
