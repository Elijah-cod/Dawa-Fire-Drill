"""Verify the database denies cross-country reads for a non-superuser role."""

import asyncio
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command


def test_database_policy_denies_other_country() -> None:
    async def run() -> None:
        url = os.environ.get(
            "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/dawa"
        )
        suffix = uuid4().hex
        schema, role = f"test_{suffix}", f"test_role_{suffix}"
        admin = create_async_engine(url)
        async with admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
            await conn.execute(text(f'CREATE ROLE "{role}" NOLOGIN'))
        engine = create_async_engine(url, connect_args={"server_settings": {"search_path": schema}})
        try:
            async with engine.begin() as conn:

                def migrate(sync_conn: Connection) -> None:
                    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
                    config.attributes["connection"] = sync_conn
                    command.upgrade(config, "head")

                await conn.run_sync(migrate)
                await conn.execute(text(f'GRANT USAGE ON SCHEMA "{schema}" TO "{role}"'))
                await conn.execute(text(f'GRANT SELECT, INSERT ON scenarios TO "{role}"'))
                await conn.execute(text(f'GRANT SELECT, INSERT ON scenario_runs TO "{role}"'))
                await conn.execute(
                    text(
                        "INSERT INTO scenarios (id, country_code, idempotency_key, "
                        "payload, created_at) "
                        "VALUES (gen_random_uuid(), 'KE', 'a', '{}', now()), "
                        "(gen_random_uuid(), 'ZZ', 'b', '{}', now())"
                    )
                )
                await conn.execute(
                    text(
                        "INSERT INTO scenario_runs (id, country_code, scenario_id, "
                        "idempotency_key, seed, horizon_days, status, attempts, created_at) "
                        "SELECT gen_random_uuid(), country_code, id, country_code, "
                        "42, 90, 'queued', 0, now() FROM scenarios"
                    )
                )
                await conn.execute(text(f'SET LOCAL ROLE "{role}"'))
                assert (
                    await conn.execute(text("SELECT count(*) FROM scenarios"))
                ).scalar_one() == 0
                assert (
                    await conn.execute(text("SELECT count(*) FROM scenario_runs"))
                ).scalar_one() == 0
                await conn.execute(text("SELECT set_config('app.country_code', 'KE', true)"))
                rows = (
                    (await conn.execute(text("SELECT country_code FROM scenarios"))).scalars().all()
                )
                assert rows == ["KE"]
                runs = (
                    (await conn.execute(text("SELECT country_code FROM scenario_runs")))
                    .scalars()
                    .all()
                )
                assert runs == ["KE"]
                with pytest.raises(DBAPIError):
                    async with conn.begin_nested():
                        await conn.execute(
                            text(
                                "INSERT INTO scenarios (id, country_code, idempotency_key, "
                                "payload, created_at) VALUES "
                                "(gen_random_uuid(), 'ZZ', 'forbidden', '{}', now())"
                            )
                        )
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
                await conn.execute(text(f'DROP ROLE "{role}"'))
            await admin.dispose()

    asyncio.run(run())
