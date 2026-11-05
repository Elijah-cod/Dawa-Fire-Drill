"""Authenticated API behavior against an isolated local Postgres schema."""

import asyncio
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import jwt
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from alembic import command
from dawa_api.app import create_app
from dawa_api.jobs.worker import process_one
from dawa_api.settings import Settings

SIGNING_MATERIAL = "synthetic-api-test-material-" * 3
BASE_URL = "https://example.invalid"


def bearer(role: str) -> dict[str, str]:
    now = datetime.now(UTC)
    encoded = jwt.encode(
        {
            "sub": "synthetic-user",
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "iss": f"{BASE_URL}/auth/v1",
            "aud": "authenticated",
            "app_metadata": {"role": role, "country_code": "KE"},
        },
        SIGNING_MATERIAL,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {encoded}"}


def test_scenario_api_auth_roles_idempotency_and_pagination() -> None:
    async def run() -> None:
        url = os.environ.get(
            "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/dawa"
        )
        schema = f"test_{uuid4().hex}"
        admin = create_async_engine(url, poolclass=NullPool)
        async with admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_async_engine(
            url, poolclass=NullPool, connect_args={"server_settings": {"search_path": schema}}
        )
        try:
            async with engine.begin() as conn:

                def migrate(sync_conn: Connection) -> None:
                    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
                    config.attributes["connection"] = sync_conn
                    command.upgrade(config, "head")

                await conn.run_sync(migrate)
            settings = Settings(
                DATABASE_URL=url, supabase_url=BASE_URL, supabase_jwt_secret=SIGNING_MATERIAL
            )
            with TestClient(create_app(settings=settings, engine=engine)) as client:
                assert client.get("/v1/scenarios").status_code == 401
                body = {
                    "name": "Synthetic shock",
                    "shock_type": "logistics_reduction",
                    "magnitude": 40,
                }
                headers = bearer("planner") | {"Idempotency-Key": "synthetic-run-1"}
                assert (
                    client.post("/v1/scenarios", json=body, headers=bearer("facility")).status_code
                    == 403
                )
                created = client.post("/v1/scenarios", json=body, headers=headers)
                assert created.status_code == 201
                replay = client.post("/v1/scenarios", json=body, headers=headers)
                assert replay.status_code == 200 and replay.json()["id"] == created.json()["id"]
                assert (
                    client.post(
                        "/v1/scenarios", json=body | {"magnitude": 41}, headers=headers
                    ).status_code
                    == 409
                )
                listing = client.get("/v1/scenarios?limit=1&offset=0", headers=bearer("pharmacist"))
                assert listing.status_code == 200 and len(listing.json()["items"]) == 1
                assert (
                    client.get(
                        f"/v1/scenarios/{created.json()['id']}", headers=bearer("planner")
                    ).status_code
                    == 200
                )
                run_headers = bearer("planner") | {"Idempotency-Key": "synthetic-job-1"}
                submitted = client.post(
                    f"/v1/scenarios/{created.json()['id']}/runs",
                    json={"seed": 42, "horizon_days": 90},
                    headers=run_headers,
                )
                assert submitted.status_code == 202
                run_id = submitted.json()["id"]
                replay_run = client.post(
                    f"/v1/scenarios/{created.json()['id']}/runs",
                    json={"seed": 42, "horizon_days": 90},
                    headers=run_headers,
                )
                assert replay_run.status_code == 200 and replay_run.json()["id"] == run_id
                assert await process_one(async_sessionmaker(engine, expire_on_commit=False), "KE")
                result = client.get(f"/v1/runs/{run_id}", headers=bearer("planner"))
                assert result.status_code == 200
                assert result.json()["status"] == "succeeded"
                assert result.json()["result"]["synthetic"] is True
                assert not await process_one(
                    async_sessionmaker(engine, expire_on_commit=False), "KE"
                )
                runs = client.get(
                    f"/v1/scenarios/{created.json()['id']}/runs?limit=1&offset=0",
                    headers=bearer("planner"),
                )
                assert runs.status_code == 200 and len(runs.json()["items"]) == 1
                failed = client.post(
                    f"/v1/scenarios/{created.json()['id']}/runs",
                    json={"seed": 42, "horizon_days": 90},
                    headers=bearer("planner") | {"Idempotency-Key": "synthetic-job-2"},
                )

                def broken_simulator(*args: object, **kwargs: object) -> None:
                    raise RuntimeError("internal error must not be exposed")

                assert await process_one(
                    async_sessionmaker(engine, expire_on_commit=False),
                    "KE",
                    simulator=broken_simulator,
                )
                failure = client.get(f"/v1/runs/{failed.json()['id']}", headers=bearer("planner"))
                assert failure.json()["status"] == "failed"
                assert failure.json()["error"] == "Scenario run failed"
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
