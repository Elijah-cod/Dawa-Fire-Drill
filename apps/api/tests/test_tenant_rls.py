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
                await conn.execute(
                    text(f'GRANT SELECT, INSERT, UPDATE, DELETE ON scenarios TO "{role}"')
                )
                await conn.execute(text(f'GRANT SELECT, INSERT ON scenario_runs TO "{role}"'))
                await conn.execute(text(f'GRANT SELECT ON extraction_cache TO "{role}"'))
                await conn.execute(
                    text(f'GRANT SELECT, UPDATE, DELETE ON synthetic_datasets TO "{role}"')
                )
                for table in ("funding_flows", "funding_diagnostics", "request_limits"):
                    await conn.execute(
                        text(f'GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO "{role}"')
                    )
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
                await conn.execute(
                    text(
                        "INSERT INTO extraction_cache (country_code, image_hash, schema_version, "
                        "fields_json) VALUES ('KE', 'a', 1, '{}'), ('ZZ', 'b', 1, '{}')"
                    )
                )
                await conn.execute(
                    text(
                        "INSERT INTO synthetic_datasets (country_code, seed, generator_version, "
                        "data, created_at) "
                        "VALUES ('KE', 1, 1, '{}', now()), ('ZZ', 1, 1, '{}', now())"
                    )
                )
                await conn.execute(
                    text(
                        "INSERT INTO funding_flows (id, country_code, idempotency_key, "
                        "payload, created_at) "
                        "VALUES (gen_random_uuid(), 'KE', 'a', '{}', now()), "
                        "(gen_random_uuid(), 'ZZ', 'b', '{}', now())"
                    )
                )
                await conn.execute(
                    text(
                        "INSERT INTO funding_diagnostics (country_code, flow_id, as_of, findings) "
                        "SELECT country_code, id, '2025-01-01', '[]' FROM funding_flows"
                    )
                )
                await conn.execute(
                    text(
                        "INSERT INTO request_limits (country_code, subject_hash, "
                        "window_start, calls) "
                        "VALUES ('KE', 'a', now(), 1), ('ZZ', 'b', now(), 1)"
                    )
                )
                await conn.execute(text(f'SET LOCAL ROLE "{role}"'))
                assert (
                    await conn.execute(text("SELECT count(*) FROM scenarios"))
                ).scalar_one() == 0
                assert (
                    await conn.execute(text("SELECT count(*) FROM scenario_runs"))
                ).scalar_one() == 0
                assert (
                    await conn.execute(text("SELECT count(*) FROM extraction_cache"))
                ).scalar_one() == 0
                assert (
                    await conn.execute(text("SELECT count(*) FROM synthetic_datasets"))
                ).scalar_one() == 0
                for table in ("funding_flows", "funding_diagnostics", "request_limits"):
                    assert (
                        await conn.execute(text(f"SELECT count(*) FROM {table}"))
                    ).scalar_one() == 0
                await conn.execute(text("SELECT set_config('app.country_code', 'KE', true)"))
                rows = (
                    (await conn.execute(text("SELECT country_code FROM scenarios"))).scalars().all()
                )
                assert rows == ["KE"]
                edited = await conn.execute(
                    text("UPDATE scenarios SET payload = '{}' RETURNING id")
                )
                assert edited.scalars().all() == []
                deleted = await conn.execute(text("DELETE FROM scenarios RETURNING id"))
                assert deleted.scalars().all() == []
                runs = (
                    (await conn.execute(text("SELECT country_code FROM scenario_runs")))
                    .scalars()
                    .all()
                )
                assert runs == ["KE"]
                cache = (
                    (await conn.execute(text("SELECT country_code FROM extraction_cache")))
                    .scalars()
                    .all()
                )
                assert cache == ["KE"]
                datasets = (
                    (await conn.execute(text("SELECT country_code FROM synthetic_datasets")))
                    .scalars()
                    .all()
                )
                assert datasets == ["KE"]
                for table in ("funding_flows", "funding_diagnostics", "request_limits"):
                    countries = (
                        (await conn.execute(text(f"SELECT country_code FROM {table}")))
                        .scalars()
                        .all()
                    )
                    assert countries == ["KE"]
                changed_funding = await conn.execute(
                    text("UPDATE funding_flows SET payload = '{}' RETURNING id")
                )
                assert changed_funding.scalars().all() == []
                deleted_funding = await conn.execute(text("DELETE FROM funding_flows RETURNING id"))
                assert deleted_funding.scalars().all() == []
                with pytest.raises(DBAPIError):
                    async with conn.begin_nested():
                        await conn.execute(
                            text(
                                "INSERT INTO request_limits (country_code, subject_hash, "
                                "window_start, calls) "
                                "VALUES ('ZZ', 'forbidden', now(), 1)"
                            )
                        )
                changed = await conn.execute(
                    text("UPDATE synthetic_datasets SET data = '{}' RETURNING seed")
                )
                assert changed.scalars().all() == []
                removed = await conn.execute(text("DELETE FROM synthetic_datasets RETURNING seed"))
                assert removed.scalars().all() == []
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
