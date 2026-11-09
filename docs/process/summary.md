# Portfolio preparation summary

## 1. Overview

- **Starting commit:** tag `pre-portfolio-prep` → `790f8f6` (tip of `phase/3b-ux`). A local `main` branch was created at that commit, because no `main` existed locally or on the remote.
- **Final commit:** the commit that adds this summary, "docs: record final checks and the portfolio preparation summary" (directly after `1528715`).
- **Commits made, one line each:**
  - `c523494` docs: audit the repository for portfolio use
  - `6216182` chore: add licence and notices, move working notes to docs/process and remove dead code
  - `e513d80` docs: rewrite the README for portfolio readers and add a case study and architecture decision records
  - `1863c55` feat: add a static fixture-only build for a public read-only demo
  - `1528715` ci: pin actions, runtimes and images and check the static demo
  - the final commit: docs: record final checks and the portfolio preparation summary
- Nothing was pushed, force-pushed or deployed. History was not rewritten.

## 2. Per stage

### Stage 1: audit

- **Added:** `docs/process/portfolio-audit.md`, `docs/process/stage-1-report.md`, `docs/process/decisions-log.md`.
- **Findings:** no licence; `PRODUCT.md` and `packages/shared/README.md` are working notes; 50 unused translation keys and `peakWindow` are dead code; the largest history blobs are old fixture versions (up to 2.4 MB) and screenshots, 54.02 MiB of loose objects in total; workflow terms appear only in working notes and `AGENTS.md`; licences listed; gitleaks over 212 commits found no leaks; clean-clone risks listed.
- **Skipped:** nothing.

### Stage 2: repository hygiene

- **Added:** `LICENSE` (MIT, Elijah Mathai), `THIRD_PARTY_NOTICES.md`, `docs/process/stage-2-report.md`.
- **Moved** (`git mv`): `PRODUCT.md` → `docs/process/product-brief.md`; `packages/shared/README.md` → `docs/process/shared-types-note.md` (empty `packages/` removed); `docs/PROGRESS.md` → `docs/process/PROGRESS.md`; `docs/phases/` (5 notes and 8 screenshots) → `docs/process/phases/`; `docs/design/critique-v2.md`, `critique-v3.md`, `critique-v4.md`, `APPROVAL.md`, `REVIEW.md`, `figma-checklist.md` → `docs/process/design/`.
- **Rewritten:** `AGENTS.md` (neutral engineering guidelines; dropped the design-approval gate, review checkpoints, phase-branch rules and the contributor-credit line); link and path updates in `README.md`, `docs/design/README.md` and the moved notes (12 broken links fixed, 0 remaining).
- **Deleted, with proof of non-use:**
  - `peakWindow` (function in `apps/web/src/components/stockout-order.tsx`) and its test: `git grep peakWindow` matched only the definition and that test.
  - 50 translation keys in both locales of `apps/web/src/preferences/preferences.tsx` (100 entries): no quoted reference in any non-test source under `apps/web/src`; the dynamic `tour_*` keys were excluded from the search.
- **Skipped:** no fixture or data deleted (all fixtures are used by tests); `scripts/demo.sh` kept (documented walkthrough); backend untouched.

### Stage 3: README and docs

- **Rewritten:** `README.md` (pitch, hero screenshot, the problem, what it does with figures from the app, Mermaid architecture, design decisions, stack, quickstart, measured tests, limitations, next steps, "How this was built").
- **Added:** `docs/case-study.md`, `docs/adr/README.md` and ADRs 0001–0007, `docs/process/stage-3-report.md`.
- **Clean-clone check:** passed after one README fix (`--retry-all-errors` on the readiness check, after `curl: (56) Connection reset by peer`).
- **Skipped:** fixing the timeline's "0 of 0 stockouts" while a run loads (product behaviour).

### Stage 4: public read-only demo

- **Added:** `apps/web/next.config.ts`, `apps/web/scripts/verify-static-demo.mjs`, `docs/deploy-demo.md`, `docs/process/stage-4-report.md`; npm scripts `build:static-demo` and `test:static-demo`.
- **Renamed:** `apps/web/src/app/api/[...path]/route.ts` → `route.proxy.ts` (a route only in the normal build).
- **Changed:** `src/app/page.tsx`, `src/app/kisumu/page.tsx` (fixture mode when `STATIC_DEMO=1`); `src/api/mock-client.ts` (fixtures allowed in production only for the static demo) and its test; `src/components/app-shell.tsx` and `preferences.tsx` (static-demo banner, English and Swahili); `route.test.ts` import; `.gitignore`, `.prettierignore`, `eslint.config.js` (ignore `.next-static`); `README.md` and `CHANGELOG.md`.
- **Incident:** my Stage 3 `docker compose down` deleted the local database (the Compose file has no volumes); I re-seeded it with the README commands. The README now warns about this.
- **Skipped:** deployment.

### Stage 5: CI

- **Changed:** `.github/workflows/ci.yml` (actions pinned to SHAs, Ubuntu 24.04, read-only permissions, concurrency, Node 24.21.0, uv 0.12.21 with Python 3.12, digest-pinned Postgres, gitleaks token, county seeding and `--retry-all-errors` in the quickstart job, logs on failure, new static-demo step); `infra/compose.yaml` (Postgres and Neo4j pinned by digest).
- **Added:** `docs/process/ci-risk.md`, `docs/process/stage-5-report.md`.
- **Skipped:** running CI (nothing pushed); pinning the API's `python:3.12-slim` base image; adding the browser suite and Lighthouse to CI.

### Stage 6: final checks and summary

- **Added:** `docs/process/final-checks.md`, `docs/process/stage-6-report.md`, this summary.
- **Skipped:** nothing.

## 3. Decisions

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Created a local `main` branch at the tip of `phase/3b-ux` (`790f8f6`) and worked there. | No `main` branch existed locally or on the remote, and `phase/3b-ux` contains every earlier phase branch. |
| 2 | Tagged `pre-portfolio-prep` on `790f8f6` before any change. | Required rollback point. |
| 3 | Added an MIT `LICENSE`, copyright "Elijah Mathai" (the only author in `git log`). | No licence file or licence field existed; the brief names MIT as the default. |
| 4 | Did not add a `license` field to `apps/api/pyproject.toml`. | The backend is out of scope; the root `LICENSE` covers the whole repository. |
| 5 | Kept `AGENTS.md`, rewritten as neutral engineering guidelines. | Most of it is sound engineering guidance; only workflow gates, review checkpoints and the contributor-credit rule were dropped. |
| 6 | Moved working notes to `docs/process/` (progress log, phase notes, critiques, approval and review records, Figma checklist, product brief, shared-types placeholder) rather than deleting them. | They record how the project was built and are not dead code; moving keeps them available. |
| 7 | Kept the design specs and both prototypes in `docs/design/`. | They are design documentation, and `npm run test:design-prototype` in CI checks the first prototype. |
| 8 | Removed `peakWindow` and 50 translation keys (both locales). | `git grep` showed no use outside their own tests; the redesign replaced that UI. |
| 9 | Left the Swahili review table in `docs/process/phases/3.md` as written, including the 50 removed keys. | It is a historical working note; the live strings are in `apps/web/src/preferences/preferences.tsx`. |
| 10 | Kept `scripts/demo.sh` and `apps/web/src/fixtures/kisumu-v2-facilities.json`. | The script is a documented API walkthrough and the fixture is used by `facility-map.test.tsx`. |
| 11 | Wrote seven ADRs (0001–0007), matching the topics in the brief one-to-one, plus an index. | Seven sits inside the requested 6–8 and each topic maps to code that exists. |
| 12 | Stated test and Lighthouse numbers in the README only as measured in this session (Vitest 162, pytest 154 at 86% coverage, Playwright 112, prototype 66 combinations, Lighthouse 1.00 / 0.74 / 1.00). | The brief forbids unmeasured numbers. |
| 13 | Verified the quickstart in a temporary clone under a separate Compose project (`COMPOSE_PROJECT_NAME=dawaclean`) with fresh volumes, then removed it and restored the existing stack. | Gives a true clean database without touching the existing local volumes. |
| 14 | Changed the README's readiness check from `--retry-connrefused` to `--retry-all-errors`. | In the clean clone the first request failed with `curl: (56) Connection reset by peer`, which `--retry-connrefused` does not retry. |
| 15 | Did not fix the timeline showing "0 of 0 stockouts" while a run is still loading. | Product behaviour is out of scope for this stage; recorded as an open item. |
| 16 | Built the public demo as the normal Next.js app with `STATIC_DEMO=1` (fixture mode, served by `next start` or Vercel) rather than a static HTML export. | Both pages are server-rendered on demand (`force-dynamic`) and the app already has a complete fixture client; a static export would need restructuring the pages. |
| 17 | Excluded the API proxy from the static build by renaming it `route.proxy.ts` and adding `proxy.ts` to `pageExtensions` only in the normal build. | The route is then absent from the static build's output, which the verification asserts, without duplicating the app. |
| 18 | The static build refuses to build or start if any of seven server-side variables is set (`DEMO_API_TOKEN`, `E2E_DEMO_TOKEN`, `API_INTERNAL_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, `OPENAI_API_KEY`, `GEMINI_API_KEY`). | These are every server-side token, secret or backend address used by the web app or API settings. |
| 19 | Added `npm run test:static-demo` as a build-and-browse script rather than a Vitest test. | The assertions need a real build and a running server; a unit test cannot see the build output. |
| 20 | Re-seeded the local database with the README's two seeding commands after it was lost. | My Stage 3 `docker compose down` removed it because the Compose file declares no volumes; the data is synthetic and reproducible from seed 42. Recorded as an incident in the Stage 4 report. |
| 21 | Pinned GitHub Actions to the commit SHAs their current major tags point to (resolved with `git ls-remote`), with the version in a comment. | "Versions pinned" for a clean runner; SHAs cannot move. |
| 22 | Pinned `postgres:16` and `neo4j:5` by the digests of the locally used images, in both CI and `infra/compose.yaml`. | Same images locally and in CI; the digests are multi-architecture index digests. |
| 23 | Left `python:3.12-slim` in `apps/api/Dockerfile` unpinned. | Changing the backend build is out of scope; recorded as a CI risk. |
| 24 | Did not add the Playwright suite or Lighthouse to CI. | They need the full stack and a demo session; adding them is new CI scope rather than a review fix. |

## 4. Results

| Check | Result |
| --- | --- |
| Web unit and component tests (Vitest) | 163 passed, 29 files |
| Web lint (ESLint) / type-check (`tsc --noEmit`) / format (Prettier) | exit 0 / exit 0 / "All matched files use Prettier code style!" |
| npm audit (`--audit-level=low`) | found 0 vulnerabilities |
| Design prototype check | 66 screen/width combinations and 2 dark-theme checks passed |
| Static demo check | 14 of 14 checks passed |
| Backend tests (pytest) | 154 passed, 1 warning; 86% line coverage |
| Ruff / mypy / Bandit | All checks passed (app and `infra/load`) / no issues in 89 source files / exit 0, no findings |
| pip-audit | No known vulnerabilities found (local `dawa-api` package skipped, not on PyPI) |
| Browser suite, local stack, fresh session | 112 passed (includes 4 token-canary tests), 0 HTTP 429 |
| gitleaks, full history | 217 commits scanned, no leaks found |
| gitleaks, working tree | 411 files scanned, no leaks found |
| History | 217 commits, one author and committer (Elijah Mathai), 0 trailers or tool mentions |
| Clean-clone quickstart | All README commands succeeded; browser suite in the clone 108 passed, 4 failed (rate limited, 6 HTTP 429), the 4 rerun alone: 16 passed |
| Lighthouse (measured earlier on this code's UI, unchanged since) | `/` 1.00; `/kisumu` page load 0.74; interaction flow 1.00 with layout shift 0.000 |

## 5. Open items

- **Most likely CI failures, in order** ([ci-risk.md](ci-risk.md)): new advisories in `npm audit --audit-level=low` or `pip-audit`; gitleaks-action needing a `GITLEAKS_LICENSE` if the repository is owned by an organization; first Linux run of `npm run test:static-demo`; the `docs-quickstart` image build (base image not pinned); timing-sensitive backend tests on a slower runner.
- **Not verified here:** any GitHub Actions run; any Vercel deployment; behaviour on Linux or amd64; a real language-model provider; Swahili quality (no native-speaker review).
- **Rate limit:** on 2026-11-09 the local demo session limit was raised from 1,200 to 2,400 requests per minute (`scripts/demo-up.sh`; `demo-down.sh` still restores 60) after the suite grew to 116 tests and tripped HTTP 429s; two full runs then passed 116/116 with no 429s. A fresh database (cold runs) has not been re-checked at the new limit.
- **UI gap:** the timeline shows "0 of 0 stockouts" while a run is still loading instead of a loading state.
- **Local data:** the Compose file has no volumes, so `docker compose down` deletes the database (the README now says so). Because the Postgres image reference changed to a digest, the next `docker compose up` will recreate your Postgres container and empty it; re-run the two seeding commands.
- **Performance:** `/kisumu` page load is under its 0.80 Lighthouse budget (documented cause: the verdict waits for the backend run).
- **Moved notes keep old context:** the Swahili review table in `docs/process/phases/3.md` still lists the 50 removed keys; the process notes describe the workflow as it was.
- **Remote state:** `origin/phase/3-frontend` exists on GitHub from an earlier push; there is no remote `main`.

## 6. How to roll back

```sh
git reset --hard pre-portfolio-prep
```

Run on `main`, this moves `main` back to `790f8f6` and discards all six commits listed above and their working-tree changes: the audit and reports, licence and notices, moved notes (they return to their old paths), restored dead code, the old README, the ADRs and case study, the static demo and its check, and the CI and Compose changes. The branch `phase/3b-ux` is untouched by this work and still points at `790f8f6`. Untracked local files are not affected. The local database is not restored by a git reset.

## 7. Next steps for you

1. Review the commits (`git log --stat pre-portfolio-prep..main`) and the README, case study and ADRs.
2. Push to the private repository (for example `git push -u origin main`), then watch the four CI jobs and paste any failures back; [ci-risk.md](ci-risk.md) lists what to expect.
3. Run `cd apps/web && npm run test:static-demo` once more, then deploy the static demo on Vercel following [deploy-demo.md](../deploy-demo.md), with `STATIC_DEMO=1` and no other server-side variables.
4. Make the repository public only after CI is green and the deployed demo shows the "Static synthetic demo" banner and no `/api` requests.
