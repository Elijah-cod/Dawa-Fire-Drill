"""Synthetic funding snapshots and idempotent diagnostics in Postgres."""

import asyncio
import os
from datetime import date
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from alembic import command
from dawa_api.finance_flow.repository import FundingConflict, FundingRepository, refresh_diagnostics
from dawa_api.finance_flow.schemas import FundingTraceRequest


def test_funding_snapshots_are_scoped_and_periodic_diagnostics_are_idempotent() -> None:
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
            data = FundingTraceRequest(
                synthetic_attested=True,
                approved=100,
                released=80,
                procured=50,
                delivered=40,
                approved_on=date(2026, 1, 1),
                released_on=date(2026, 1, 4),
                procured_on=date(2026, 1, 7),
                delivered_on=date(2026, 1, 9),
                as_of=date(2026, 1, 11),
            )
            async with sessions.begin() as session:
                repo = FundingRepository(session, country_code="KE")
                record, created = await repo.create("funding-key", data)
                record_id = record.id
                assert created
                replay, created = await repo.create("funding-key", data)
                assert not created and replay.id == record_id
                with pytest.raises(FundingConflict):
                    await repo.create("funding-key", data.model_copy(update={"approved": 101}))
                assert await FundingRepository(session, country_code="ZZ").get(record_id) is None
            assert (
                await refresh_diagnostics(sessions, country_code="KE", as_of=date(2026, 1, 11)) == 1
            )
            assert (
                await refresh_diagnostics(sessions, country_code="KE", as_of=date(2026, 1, 11)) == 0
            )
            async with sessions.begin() as session:
                finding = await FundingRepository(session, country_code="KE").get_diagnostic(
                    record_id, as_of=date(2026, 1, 11)
                )
                assert finding is not None and finding.findings[0]["age_days"] == 10
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
