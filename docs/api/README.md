# API documentation

All data must be **synthetic, calibrated to public aggregates**, and model outputs are **illustrative and unvalidated**. No calibrated seed dataset exists yet. Do not publish accuracy claims.

`/health` is public. `/v1/scenarios` supports paginated GET and authenticated POST, and `/v1/scenarios/{id}` supports authenticated GET. POST requires an `Idempotency-Key` header; the same key and payload returns the original record, while a different payload returns 409. Only planner and admin roles can create scenarios. A signed token's trusted `app_metadata` supplies `role` and `country_code`; requests cannot choose a tenant in a header or payload.

The current verifier supports legacy Supabase HS256 JWTs configured with backend-only `SUPABASE_URL` and `SUPABASE_JWT_SECRET`. Asymmetric JWKS verification is not implemented. Missing or invalid configuration fails authentication closed. The Postgres policy requires transaction-local country context. Use a non-superuser application database role without `BYPASSRLS`; Postgres superusers bypass row-level security.

Run `DATABASE_URL=... uv run alembic upgrade head` with a configured backend-only Postgres connection to apply migrations; `uv run alembic downgrade base` reverses the initial migration. Do not commit or print real connection strings.
