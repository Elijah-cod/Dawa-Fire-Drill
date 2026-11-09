# Stage 3 report: README and docs

## Done

- **README.md rewritten** for a portfolio reader: pitch, hero screenshot (`docs/screenshots/readme-verdict-1280.png`), the data policy, "The problem", "What it does" (the guided-demo story with figures read from the app at seed 42, generator v5), screenshots, a Mermaid architecture diagram, key design decisions linked to ADRs, tech stack, quickstart, tests with measured numbers, limitations, next steps, and "How this was built".
- **Added `docs/case-study.md`** (one page).
- **Added `docs/adr/`**: index plus seven records: 0001 synthetic data with versioned generators, 0002 optimizer decides and AI explains, 0003 row-level tenancy, 0004 deterministic versioned simulation, 0005 Postgres-backed queue, 0006 language-model provider abstraction, 0007 illustrative cost units. Facts checked against the code: RLS policy in `alembic/versions/0002_scenario_rls.py`, lease token and five-minute lease in `dawa_api/jobs/repository.py`, OpenAI and Gemini providers in `dawa_api/capture/providers.py` and `dawa_api/explain/providers.py`, `llm_daily_call_cap` in `dawa_api/settings.py`, deterministic fallback in `dawa_api/explain/service.py`, generator versions 1–5 and simulator versions 1–2.
- Link check over all tracked and new Markdown files: 0 broken relative links.

## Clean-clone quickstart

Cloned `main` (`6216182`) into a temporary directory and ran the README commands verbatim with `COMPOSE_PROJECT_NAME=dawaclean` (fresh volumes):

```
docker compose -f infra/compose.yaml up -d --build      → api, worker, migrate, postgres, neo4j started
curl --fail --retry 20 --retry-delay 3 --retry-connrefused http://localhost:8000/ready
                                                         → curl: (56) Recv failure: Connection reset by peer
… exec -T api python -m dawa_api.ingestion.persist --country KE --seed 42
                                                         → {"synthetic": true, "country_code": "KE", "seed": 42, "generator_version": 6, "created": true}
… exec -T api python -m dawa_api.ingestion.seed_counties --seed 42
                                                         → {"synthetic": true, "planning_created": 47, "pilot_created": 1}
(cd apps/web && npm ci)                                  → added 571 packages … found 0 vulnerabilities
bash scripts/demo-up.sh                                  → Demo ready: http://localhost:3300/kisumu (token valid for 4 hours).
curl -s --fail http://localhost:8000/ready (afterwards)  → {"status":"ready","database":"ready"}
```

Fix applied: the readiness check now uses `--retry-all-errors`, which retries the connection reset seen while the API starts.

Browser suite in the clean clone (`scripts/demo-up.sh -- npx playwright test`): **111 passed, 1 failed** ("the timeline counts match the run at days 0, 41 and 90" at 1536 px timed out with the readout at "0 of 0 stockouts" after the API logged one HTTP 429 from the shared demo identity). Rerun of that test alone in the clone: **4 passed**. The clone's stack, volumes and images were removed and the existing stack and demo session restored.

## Tests

No product code changed in this stage. Vitest 162 passed.

## Skipped

- The "0 of 0 stockouts" display while a run is pending was not fixed (product behaviour; see open items in the summary).
