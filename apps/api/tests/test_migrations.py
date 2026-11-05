"""Exercise migration upgrade and downgrade in an isolated Postgres schema."""

import asyncio
import os
from pathlib import Path
from uuid import uuid4

from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command


def test_migrations_upgrade_and_downgrade() -> None:
    async def run() -> None:
        url = os.environ.get(
            "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/dawa"
        )
        schema = f"test_{uuid4().hex}"
        admin = create_async_engine(url)
        async with admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_async_engine(url, connect_args={"server_settings": {"search_path": schema}})
        try:
            async with engine.begin() as conn:

                def migrate(sync_conn: Connection) -> None:
                    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
                    config.attributes["connection"] = sync_conn
                    command.upgrade(config, "0008_request_limits")
                    scenario_id = sync_conn.execute(
                        text(
                            "INSERT INTO scenarios (id, country_code, idempotency_key, "
                            "payload, created_at) "
                            "VALUES (gen_random_uuid(), 'KE', 'migration-scenario', '{}', now()) "
                            "RETURNING id"
                        )
                    ).scalar_one()
                    sync_conn.execute(
                        text(
                            "INSERT INTO scenario_runs (id, country_code, scenario_id, "
                            "idempotency_key, "
                            "seed, horizon_days, status, attempts, created_at, result) VALUES "
                            "(gen_random_uuid(), 'KE', :scenario, 'old', 42, 90, "
                            "'succeeded', 1, now(), '{}'), "
                            "(gen_random_uuid(), 'KE', :scenario, 'new', 42, 90, "
                            "'succeeded', 1, now(), "
                            "'{\"simulation_version\": 2}')"
                        ),
                        {"scenario": scenario_id},
                    )
                    command.upgrade(config, "head")
                    versions = dict(
                        sync_conn.execute(
                            text("SELECT idempotency_key, simulation_version FROM scenario_runs")
                        ).all()
                    )
                    assert versions == {"old": 1, "new": 2}
                    assert inspect(sync_conn).has_table("scenarios")
                    command.downgrade(config, "base")
                    assert not inspect(sync_conn).has_table("scenarios")

                await conn.run_sync(migrate)
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
