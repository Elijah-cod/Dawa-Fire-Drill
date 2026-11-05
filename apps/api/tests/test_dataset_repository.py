"""Verify immutable synthetic dataset snapshots in local Postgres."""

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
from dawa_api.ingestion.repository import DatasetRepository


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
            async with sessions.begin() as session:
                repo = DatasetRepository(session, country_code="KE")
                first, created = await repo.ensure(seed=42)
                assert created and first.data["synthetic"] is True
                again, created = await repo.ensure(seed=42)
                assert not created and again.data == first.data
                assert await DatasetRepository(session, country_code="ZZ").get(seed=42) is None
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
