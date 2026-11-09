# Portfolio audit

Audit of the repository at tag `pre-portfolio-prep` (`790f8f6`) before preparing it for public portfolio use. No files were changed for this audit.

## Top-level files

| Path | Finding | Proposed action |
| --- | --- | --- |
| `README.md` | Product README written for the build team (phase notes, checkpoint wording). | Rewrite for a portfolio reader (Stage 3). |
| `CHANGELOG.md` | Conventional changelog, newest first. | Keep. |
| `AGENTS.md` | Mostly sensible engineering rules (truthfulness, secrets, stack, test gate), plus workflow-only lines: a design-approval phrase gate, review checkpoints, phase branches and a rule about contributor credit. | Rewrite neutrally as engineering guidance; drop the workflow and contributor-credit lines (Stage 2). |
| `PRODUCT.md` | Product context written as input for a design-review tool (mentions the tool's schema marker). | Working note: move to `docs/process/` (Stage 2). |
| `packages/shared/README.md` | Placeholder for generated shared types; nothing imports it, and the generated types live in `apps/web/src/generated/api.ts`. | Working note: move to `docs/process/`, remove the empty `packages/` directory (Stage 2). |
| `.pre-commit-config.yaml`, `.gitignore`, `.github/` | Tooling. | Keep. |
| No `LICENSE` | No licence file and no licence field in `apps/web/package.json` or `apps/api/pyproject.toml`. | Add MIT plus third-party notices (Stage 2). |
| Untracked, ignored local tool folders (`.claude/`, `.impeccable/`, `.github/skills/`, `CLAUDE.md`) | Already excluded by local ignore rules; not in the repository or its history. | Leave untouched. |

## Dead code and unused fixtures

Proof is `git grep` over tracked files (excluding images) at the audit commit.

| Item | Evidence | Proposed action |
| --- | --- | --- |
| `peakWindow` in `apps/web/src/components/stockout-order.tsx` | Referenced only by its definition and its own test (`stockout-order.test.tsx`); the redesigned order list no longer shows the busiest week. | Remove with its test. |
| 50 translation keys in `apps/web/src/preferences/preferences.tsx` (old ranked-fixes and shock-summary UI: `shockLabel`, `baseline`, `scenarioRunning`, `previousRun`, `shockFirst`, `summary*`, `showAll*`, `noShockStockouts`, `doThisFirst`, `rank*` except `rankOffline`/`rankUnreachable`/`rankEnglishOnly`/`rankNoExplanation`, `shockDetailsUnavailable`, `whyTransferTo`, `whyEmergencyTo`) | No quoted reference outside tests in `apps/web/src` (script: list the `en` keys, search non-test sources for the quoted key; dynamic `tour_*` keys excluded). | Remove from both locales. |
| `apps/web/src/fixtures/kisumu-v2-facilities.json` | Used by `facility-map.test.tsx`. | Keep. |
| `scripts/demo.sh` | Documented API walkthrough (`docs/phases/2.md`); not dead. | Keep. |
| Backend (`apps/api/dawa_api`) | `vulture --min-confidence 80` reports only the `cls` parameter of Pydantic validators (false positives). | No change (backend is out of scope). |

## Large files in history

`git rev-list --objects --all | git cat-file --batch-check | sort by size`, top 20 blobs (bytes, object, path):

```
   2439999  d53d6325fe  apps/web/src/fixtures/kisumu.json
   1553900  caef38f7ef  apps/web/src/fixtures/kisumu.json
   1552283  8b628d7e93  apps/web/src/fixtures/kisumu.json
   1549487  d111cece0f  apps/web/src/fixtures/kisumu.json
    812853  7bae14ecd3  docs/phases/screenshots/ranked-fixes-768.png
    583021  dc8042312d  docs/design/prototype/kisumu-v2/screenshots/v4/facilities-40.png
    571224  2825ad9d06  docs/phases/screenshots/ranked-fixes-1280.png
    569138  81050d645e  docs/phases/screenshots/ranked-fixes-1536.png
    549058  9b242f5418  docs/phases/screenshots/ranked-fixes-390.png
    491044  764bae040a  docs/design/prototype/kisumu-v2/screenshots/v4/map-1280-dark.png
    486102  b3f26fcbe1  docs/design/prototype/kisumu-v2/screenshots/v4/map-1280.png
    440223  5acffeaacf  apps/web/src/fixtures/kisumu.json
    429072  34bd9d202c  docs/design/prototype/kisumu-v2/screenshots/v4/fixes-390-dark.png
    417929  ea3e91f8b6  docs/design/prototype/kisumu-v2/screenshots/v4/map-390.png
    383266  e8a083b22d  docs/design/prototype/kisumu-v2/screenshots/v3/map-1280-dark.png
    379999  080376e003  docs/design/prototype/kisumu-v2/screenshots/v3/map-1280.png
    369333  92cc2fbc91  docs/design/prototype/kisumu-v2/screenshots/v3/facilities-40.png
    354560  074ae0e203  apps/web/src/fixtures/kisumu.json
    324714  d4401c3c07  apps/web/src/fixtures/kisumu.json
    324548  016f88d4f8  apps/web/src/fixtures/kisumu.json
```

`git count-objects -vH`: 3,621 loose objects, 54.02 MiB. The largest items are earlier versions of the development fixture (`apps/web/src/fixtures/kisumu.json`, up to 2.4 MB before trimming) and design screenshots. Nothing is large enough to need history rewriting, and rewriting is out of scope.

## Temporary workflow and internal notes

`git grep -il` over tracked text files:

- Design-review tool name: `PRODUCT.md`, `docs/design/critique-v2.md`, `critique-v3.md`, `critique-v4.md`.
- "agent": `AGENTS.md`, `CHANGELOG.md`, `README.md`, `docs/PROGRESS.md`, the critiques, `docs/phases/0.md`.
- Approval phrase and checkpoints: `AGENTS.md`, `README.md`, `docs/PROGRESS.md`, `docs/design/README.md`, `REVIEW.md`, `APPROVAL.md`, `figma-checklist.md`, `docs/phases/*.md`.
- "Claude", "Codex", "Copilot": no matches in tracked files.

Working notes to move under `docs/process/`: `docs/PROGRESS.md`, `docs/phases/` (with its screenshots), `docs/design/critique-v2.md`, `critique-v3.md`, `critique-v4.md`, `docs/design/APPROVAL.md`, `docs/design/REVIEW.md`, `docs/design/figma-checklist.md`, `PRODUCT.md`. Design specs (`docs/design/README.md`, `screens.md`, `tokens.md`, `components-and-responsive.md`, `roles-and-flows.md`, `strings.md`, `addendum-counties.md`, `fonts.md`, `prototype/`) stay as design documentation.

## Licences in use

| Component | Licence | Where |
| --- | --- | --- |
| Source Serif 4 (Adobe, via Fontsource 5.3.1) | SIL Open Font License 1.1 | `apps/web/public/fonts/`, preview `docs/design/prototype/kisumu-v2/fonts/`; licence text shipped alongside |
| OpenStreetMap map tiles and data | Data: Open Database License (ODbL) 1.0, © OpenStreetMap contributors; tiles subject to the OSM Foundation tile usage policy | Facility map; attribution shown in the map |
| MapLibre GL JS 6.16.0 | BSD-3-Clause | web dependency |
| Next.js 16.4.5, React 19.3.1, Tailwind CSS 4.3.5 | MIT | web dependencies |
| Playwright 1.64.1, Lighthouse 13.6.0, @lhci/cli 0.16.0, puppeteer-core 25.16.0, TypeScript 5.9.3 | Apache-2.0 | web dev dependencies |
| @axe-core/playwright 4.14.0 | MPL-2.0 | web dev dependency |
| Vitest, ESLint, Prettier, Testing Library, jsdom, openapi-typescript | MIT | web dev dependencies |
| FastAPI, Pydantic Settings, SQLAlchemy, Alembic, PyJWT | MIT | API dependencies |
| OR-Tools 9.15 | Apache-2.0 | API dependency |
| asyncpg, python-multipart | Apache-2.0 | API dependencies |
| Neo4j Python driver 6.4.1 | Apache-2.0 (with Python-2.0 parts) | API dependency |
| pandas, statsmodels, uvicorn, httpx | BSD-3-Clause | API dependencies |
| Pillow 13.0.0 | MIT-CMU (HPND) | API dependency |
| pytest, ruff, mypy, pre-commit, Schemathesis | MIT; Hypothesis MPL-2.0; Bandit, pip-audit Apache-2.0 | API dev dependencies |
| Container images `postgres:16`, `neo4j:5` | PostgreSQL License; Neo4j Community Edition GPLv3 | `infra/compose.yaml` (not redistributed) |
| Public aggregate sources cited in `docs/data-assumptions.md` | Cited by URL as calibration references; no data files redistributed | docs |

## Secrets risk

`gitleaks git --log-opts=--all --redact -v` (v8.30.1, Docker) on the full history, full output:

```

    ○
    │╲
    │ ○
    ○ ░
    ░    gitleaks

6:46AM INF 212 commits scanned.
6:46AM INF scanned ~11980588 bytes (11.98 MB) in 7.35s
6:46AM INF no leaks found
```

No real secrets found. The demo token and signing secret are generated per session by `scripts/demo-up.sh` and never written to the repository; only `.env.example` templates are tracked.

## Clean-clone risks

- No `next.config` file; the static demo (Stage 4) will add one.
- The quickstart needs Docker, `uv` (the demo script mints its token with the API's environment), Node.js with npm and `lsof`; `uv run --frozen` downloads Python packages on first use.
- Browser tests need `npx playwright install chromium` and a running demo session (`bash scripts/demo-up.sh`), which the README does not yet say in one place.
- Container images use floating tags (`postgres:16`, `neo4j:5`), so a later clone can pull different patch versions.
- The CI quickstart job seeds the country snapshot but not the county planning data the web demo uses.
