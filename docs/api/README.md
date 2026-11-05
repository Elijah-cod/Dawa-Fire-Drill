# API documentation

All data must be **synthetic, calibrated to public aggregates**, and model outputs are **illustrative and unvalidated**. No calibrated seed dataset exists yet. Do not publish accuracy claims.

`/health` is public. `/v1/scenarios` supports paginated GET and authenticated POST, and `/v1/scenarios/{id}` supports authenticated GET. POST requires an `Idempotency-Key` header; the same key and payload returns the original record, while a different payload returns 409. Only planner and admin roles can create scenarios. A signed token's trusted `app_metadata` supplies `role` and `country_code`; requests cannot choose a tenant in a header or payload.

The current verifier supports legacy Supabase HS256 JWTs configured with backend-only `SUPABASE_URL` and `SUPABASE_JWT_SECRET`. Asymmetric JWKS verification is not implemented. Missing or invalid configuration fails authentication closed. The Postgres policy requires transaction-local country context. Use a non-superuser application database role without `BYPASSRLS`; Postgres superusers bypass row-level security.

`POST /v1/scenarios/{id}/runs` queues a seeded run with `seed` and `horizon_days` and requires an `Idempotency-Key`. A matching replay returns the existing run; a conflicting replay returns 409. `GET /v1/runs/{id}` returns the country-scoped status and result, and paginated `GET /v1/scenarios/{id}/runs` lists runs for comparison. Results and input data are synthetic; stockout outputs are illustrative and unvalidated.

`python -m dawa_api.jobs.worker --country KE` polls the Postgres queue; add `--once` to process at most one run. Workers claim rows with a five-minute lease and a fencing token. A failed run exposes a generic error rather than provider or database details. The local Compose stack runs migrations and the worker automatically. It uses disposable local superuser credentials; production must use a restricted application role.

`POST /v1/optimization/rank` accepts synthetic candidate costs, assumed benefits, and an integer budget ceiling from a planner or admin. OR-Tools maximizes assumed benefit, minimizes cost among equally beneficial sets, and orders selected actions. The response includes the selected order, cut line, remaining budget, and inclusion/exclusion codes. These are illustrative calculations, not validated impact estimates. Candidate benefits and costs are supplied inputs; this endpoint does not yet derive mitigations from a scenario run.

Run `DATABASE_URL=... uv run alembic upgrade head` with a configured backend-only Postgres connection to apply migrations; `uv run alembic downgrade base` reverses the initial migration. Do not commit or print real connection strings.
