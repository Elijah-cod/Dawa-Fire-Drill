"""Verify immutable synthetic dataset snapshots in local Postgres."""

import asyncio
import os
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from alembic import command
from dawa_api.countries.ke.counties import KENYA_COUNTIES
from dawa_api.ingestion.county_repository import CountySnapshotRepository
from dawa_api.ingestion.repository import DatasetRepository
from dawa_api.ingestion.seed_counties import seed_counties
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.kisumu import simulate_kisumu


def test_seed_snapshot_is_idempotent_and_country_scoped() -> None:
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
            seeded = await seed_counties(sessions, seed=43)
            assert seeded == {"synthetic": True, "planning_created": 47, "pilot_created": 1}
            repeated = await seed_counties(sessions, seed=43)
            assert repeated == {"synthetic": True, "planning_created": 0, "pilot_created": 0}
            async with sessions.begin() as session:
                repo = DatasetRepository(session, country_code="KE")
                first, created = await repo.ensure(seed=42)
                assert created and first.data["synthetic"] is True
                again, created = await repo.ensure(seed=42)
                assert not created and again.data == first.data
                assert await DatasetRepository(session, country_code="ZZ").get(seed=42) is None
                kisumu = CountySnapshotRepository(session, country_code="KE", county_code="042")
                nairobi = CountySnapshotRepository(session, country_code="KE", county_code="047")
                planning, created = await kisumu.ensure(seed=42, kind="planning")
                assert created and planning.data["county_code"] == "042"
                assert await nairobi.get(seed=42, kind="planning") is None
                other, created = await nairobi.ensure(seed=42, kind="planning")
                assert created and other.data["county_code"] == "047"
                pilot, created = await kisumu.ensure(seed=42, kind="pilot")
                assert created and pilot.data["county_code"] == "042"
                assert await nairobi.get(seed=42, kind="pilot") is None
                again, created = await kisumu.ensure(seed=42, kind="pilot")
                assert not created and again.data == pilot.data
                try:
                    await nairobi.ensure(seed=42, kind="pilot")
                except ValueError:
                    pass
                else:
                    raise AssertionError("Facility simulation outside Kisumu was accepted")
                started = perf_counter()
                for county in KENYA_COUNTIES:
                    await CountySnapshotRepository(
                        session, country_code="KE", county_code=county.code
                    ).ensure(seed=42, kind="planning")
                count = (
                    await session.execute(
                        text(
                            "SELECT count(*) FROM county_snapshots "
                            "WHERE kind='planning' AND seed=42"
                        )
                    )
                ).scalar_one()
                assert count == 47
                result = simulate_kisumu(
                    ScenarioCreate(
                        name="synthetic", shock_type="logistics_reduction", magnitude=40
                    ),
                    pilot.data,
                    horizon_days=90,
                )
                assert result["stockouts"]
                assert perf_counter() - started < 10
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
