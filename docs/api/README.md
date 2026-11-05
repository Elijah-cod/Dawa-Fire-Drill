# API documentation

The API currently exposes only the health endpoint. Scenario storage is implemented but is not yet exposed as an API. All eventual returned data must be labeled **synthetic, calibrated to public aggregates**, and all model outputs **illustrative and unvalidated**. Do not publish accuracy claims.

Run `DATABASE_URL=... uv run alembic upgrade head` with a configured backend-only Postgres connection to apply migrations; `uv run alembic downgrade base` reverses the initial migration. Do not commit or print real connection strings.
