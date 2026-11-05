"""Capture review and shared provider budget against isolated Postgres."""

import asyncio
import os
from datetime import date
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import func, select, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from alembic import command
from dawa_api.capture.extraction import BinCardFields
from dawa_api.capture.repository import CaptureConflict, CaptureRepository, PostgresExtractionStore
from dawa_api.storage.models import StockEntry


def test_shared_cap_cache_and_human_confirmation() -> None:
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
            store = PostgresExtractionStore(sessions, daily_cap=2)
            assert sum(await asyncio.gather(*(store.reserve() for _ in range(8)))) == 2
            fields = BinCardFields(
                commodity_name="Synthetic item",
                opening_balance=5,
                closing_balance=3,
                record_date=date(2026, 1, 1),
            )
            digest = "a" * 64
            await store.put("KE", digest, fields.model_dump_json())
            assert await store.get("KE", digest) is not None
            assert await store.get("ZZ", digest) is None
            async with sessions.begin() as session:
                repo = CaptureRepository(session, country_code="KE")
                draft, created = await repo.create(
                    "capture-key", "SYN-KE-F001", "synthetic-user", digest, fields, "extracted"
                )
                draft_id = draft.id
                assert created and draft.status == "pending"
                assert (
                    await session.execute(select(func.count()).select_from(StockEntry))
                ).scalar_one() == 0
                with pytest.raises(ValueError):
                    await repo.confirm(draft_id, fields, "synthetic-user", reviewed=False)
                entry, created = await repo.confirm(
                    draft_id, fields, "synthetic-user", reviewed=True
                )
                assert created and entry.closing_balance == 3
                repeated, created = await repo.confirm(
                    draft_id, fields, "synthetic-user", reviewed=True
                )
                assert not created and repeated.id == entry.id
                with pytest.raises(CaptureConflict):
                    await repo.confirm(
                        draft_id,
                        fields.model_copy(update={"closing_balance": 4}),
                        "synthetic-user",
                        reviewed=True,
                    )
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
