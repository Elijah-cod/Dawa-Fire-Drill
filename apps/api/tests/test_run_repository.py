"""Exercise durable queue behavior in an isolated local Postgres schema."""

import asyncio
import os
from pathlib import Path
from uuid import uuid4

from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from alembic import command
from dawa_api.jobs.repository import RunConflict, RunRepository
from dawa_api.storage.scenarios import ScenarioRepository


def test_run_queue_idempotency_claims_and_country_isolation() -> None:
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
            sessions = async_sessionmaker(engine, expire_on_commit=False)
            async with sessions.begin() as session:
                scenario, _ = await ScenarioRepository(session, country_code="KE").create(
                    "scenario", {"name": "synthetic", "shock_type": "cash_delay", "magnitude": 45}
                )
                scenario_id = scenario.id
                repo = RunRepository(session, country_code="KE")
                submitted, created = await repo.create(
                    scenario_id, "run-key", seed=42, horizon_days=90
                )
                run_id = submitted.id
                assert created
                assert submitted.simulation_version == 4
                replay, created = await repo.create(
                    scenario_id, "run-key", seed=42, horizon_days=90
                )
                assert not created and replay.id == run_id
                try:
                    await repo.create(scenario_id, "run-key", seed=43, horizon_days=90)
                except RunConflict:
                    pass
                else:
                    raise AssertionError("Conflicting run key accepted")
            async with sessions() as first, sessions() as second:
                async with first.begin():
                    claimed = await RunRepository(first, country_code="KE").claim_next()
                    assert claimed is not None and claimed.id == run_id and claimed.lease_token
                    lease = claimed.lease_token
                    async with second.begin():
                        assert await RunRepository(second, country_code="KE").claim_next() is None
                async with second.begin():
                    assert await RunRepository(second, country_code="ZZ").get(run_id) is None
                    repo = RunRepository(second, country_code="KE")
                    assert not await repo.complete(run_id, uuid4(), {"synthetic": True})
                    await second.execute(
                        text(
                            "UPDATE scenario_runs SET lease_until = now() - interval '1 second' "
                            "WHERE id = :id"
                        ),
                        {"id": run_id},
                    )
                    reclaimed = await repo.claim_next()
                    assert (
                        reclaimed is not None
                        and reclaimed.lease_token
                        and reclaimed.lease_token != lease
                    )
                    assert not await repo.complete(run_id, lease, {"synthetic": True})
                    assert await repo.complete(run_id, reclaimed.lease_token, {"synthetic": True})
                async with first.begin():
                    finished = await RunRepository(first, country_code="KE").get(run_id)
                    assert finished is not None and finished.status == "succeeded"
                    assert finished.result == {"synthetic": True}
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
