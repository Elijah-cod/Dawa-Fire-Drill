"""Integration contract against an isolated schema in the local Postgres service."""

import asyncio
import os
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from dawa_api.storage.models import Base
from dawa_api.storage.scenarios import IdempotencyConflict, ScenarioRepository


def test_country_isolation_idempotency_and_pagination() -> None:
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
                await conn.run_sync(Base.metadata.create_all)
            sessions = async_sessionmaker(engine, expire_on_commit=False)
            async with sessions() as session:
                repo = ScenarioRepository(session, country_code="KE")
                one, created = await repo.create("key-1", {"name": "synthetic one"})
                assert created
                same, created = await repo.create("key-1", {"name": "synthetic one"})
                assert not created and same.id == one.id
                try:
                    await repo.create("key-1", {"name": "different"})
                except IdempotencyConflict:
                    pass
                else:
                    raise AssertionError("Conflicting idempotency key accepted")
                await repo.create("key-2", {"name": "synthetic two"})
                other = ScenarioRepository(session, country_code="ZZ")
                await other.create("key-1", {"name": "other country"})
                await session.commit()
                assert await other.get(one.id) is None
                assert [x.id for x in await repo.list_page(limit=1, offset=0)] == [one.id]
                assert len(await repo.list_page(limit=1, offset=1)) == 1
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
