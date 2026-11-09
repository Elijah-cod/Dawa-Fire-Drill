# Stage 5 report: CI

## Done

- Reviewed `.github/workflows/ci.yml` and changed it so every job runs on a clean runner with declared services and pinned versions. The full list of changes is in [`ci-risk.md`](ci-risk.md#changes-made-in-the-review).
- Pinned the Postgres and Neo4j images by digest in `infra/compose.yaml` (same digests as CI).
- Wrote `docs/process/ci-risk.md`: likely failures in order, plus known gaps.

## Checks

- `actionlint` 1.7.7 (Docker): exit 0, no findings.
- `docker compose -f infra/compose.yaml config --quiet`: OK.
- Workflow YAML parses.
- No job reads untracked files or local state. The backend tests use only the Postgres service, with Neo4j, Docker, `curl` and `lsof` faked. The static-demo check builds from tracked files only.

## Tests

No application code changed in this stage. Vitest, ESLint and the type check were last run at the end of Stage 4 (all green).

## Skipped

- The CI run itself (nothing is pushed).
- Pinning the API's `python:3.12-slim` base image (backend build out of scope).
- Adding the browser suite and Lighthouse to CI (they need the full stack).
