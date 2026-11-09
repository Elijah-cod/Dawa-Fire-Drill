# Third-party notices

This project's own code is under the [MIT License](LICENSE). It uses the third-party components below under their own licences. Versions are those pinned in `apps/web/package-lock.json` and `apps/api/uv.lock` at the time of writing.

## Font

- **Source Serif 4** (Adobe), Semibold, Latin subset, taken from the Fontsource package `@fontsource/source-serif-4` 5.3.1. Licence: SIL Open Font License 1.1. The licence text ships next to the font in `apps/web/public/fonts/OFL-source-serif-4.txt` (and in the design preview folder). Upstream: https://github.com/adobe-fonts/source-serif. Details: [`docs/design/fonts.md`](docs/design/fonts.md).

## Map tiles and data

- **OpenStreetMap** map tiles and data, shown in the Kisumu facility map. Data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0 (https://www.openstreetmap.org/copyright). The map shows this attribution. Tiles are requested from `tile.openstreetmap.org` by default, which is subject to the OpenStreetMap Foundation tile usage policy (https://operations.osmfoundation.org/policies/tiles/); set `NEXT_PUBLIC_OSM_TILE_URL` to use another tile provider.
- **MapLibre GL JS** 6.16.0, map rendering. Licence: BSD-3-Clause.
- Facility coordinates, names and stock are invented; no third-party facility data is included.

## Key runtime dependencies

| Component | Version | Licence |
| --- | --- | --- |
| Next.js | 16.4.5 | MIT |
| React, React DOM | 19.3.1 | MIT |
| Tailwind CSS | 4.3.5 | MIT |
| FastAPI | 0.162.0 | MIT |
| Pydantic Settings | 2.16.2 | MIT |
| SQLAlchemy | 2.1.8 | MIT |
| Alembic | 1.20.1 | MIT |
| PyJWT | 2.15.1 | MIT |
| Google OR-Tools | 9.15 | Apache-2.0 |
| asyncpg | 0.32.0 | Apache-2.0 |
| python-multipart | 0.0.33 | Apache-2.0 |
| Neo4j Python driver | 6.4.1 | Apache-2.0 (with Python-2.0 parts) |
| pandas | 2.3.3 | BSD-3-Clause |
| statsmodels | 0.15.0 | BSD-3-Clause |
| uvicorn | 0.54.0 | BSD-3-Clause |
| httpx | 0.28.1 | BSD-3-Clause |
| Pillow | 13.0.0 | MIT-CMU (HPND) |

## Development and test tools

| Component | Licence |
| --- | --- |
| Playwright, Lighthouse, Lighthouse CI, puppeteer-core, TypeScript | Apache-2.0 |
| axe-core for Playwright | MPL-2.0 |
| Vitest, ESLint, typescript-eslint, Prettier, Testing Library, jsdom, openapi-typescript | MIT |
| pytest, pytest-cov, Ruff, mypy, pre-commit, Schemathesis | MIT |
| Hypothesis | MPL-2.0 |
| Bandit, pip-audit | Apache-2.0 |

## Container images used locally (not redistributed)

- `postgres:16`: PostgreSQL License.
- `neo4j:5` (Community Edition): GPLv3. Used only as a local service through Docker Compose.

## Public sources cited for calibration

`docs/data-assumptions.md` cites public reports by URL as aggregate calibration references. No data files from those sources are included in the repository.
