"""County API permissions against isolated PostgreSQL data."""

import asyncio
import os
from pathlib import Path
from uuid import uuid4

from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from alembic import command
from dawa_api.app import create_app
from dawa_api.auth.service import Principal
from dawa_api.ingestion.county_repository import CountySnapshotRepository
from dawa_api.scenarios.router import current_principal
from dawa_api.settings import Settings


def test_county_endpoints_enforce_county_and_role_scopes() -> None:
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
            async with async_sessionmaker(engine, expire_on_commit=False).begin() as session:
                for code in ("042", "047"):
                    await CountySnapshotRepository(
                        session, country_code="KE", county_code=code
                    ).ensure(seed=42, kind="planning")
                await CountySnapshotRepository(
                    session, country_code="KE", county_code="042"
                ).ensure(seed=42, kind="pilot")
            app = create_app(settings=Settings(DATABASE_URL=url), engine=engine)
            principal = Principal(
                subject="synthetic", role="planner", country_code="KE", county_code="042"
            )
            app.dependency_overrides[current_principal] = lambda: principal
            with TestClient(app) as client:
                own = client.get("/v1/counties/042/planning?seed=42")
                assert own.status_code == 200 and own.json()["county_code"] == "042"
                assert client.get("/v1/counties/047/planning?seed=42").status_code == 403
                assert client.get("/v1/counties/042/pilot?seed=42").status_code == 200
                assert client.get("/v1/counties/047/pilot?seed=42").status_code in (403, 404)
                assert client.get("/v1/counties/overview?seed=42").status_code == 403
                principal = Principal(
                    subject="synthetic", role="planner", country_code="KE", national_planning=True
                )
                overview = client.get("/v1/counties/overview?seed=42")
                assert overview.status_code == 200 and len(overview.json()["items"]) == 47
                assert client.get("/v1/counties/042/pilot?seed=42").status_code == 403
                principal = Principal(
                    subject="synthetic",
                    role="facility",
                    country_code="KE",
                    county_code="042",
                    facility_id="SYN-KE-042-F001",
                )
                assert client.get("/v1/counties/042/pilot?seed=42").status_code == 403
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
