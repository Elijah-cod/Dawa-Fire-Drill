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
from dawa_api.jobs.county_repository import CountyRunRepository
from dawa_api.jobs.county_worker import process_kisumu_one
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
                request_body = {
                    "name": "Synthetic donor shock",
                    "shock_type": "logistics_reduction",
                    "magnitude": 40,
                    "seed": 42,
                    "horizon_days": 90,
                }
                headers = {"Idempotency-Key": "county-run-test"}
                submitted = client.post("/v1/counties/042/runs", json=request_body, headers=headers)
                assert submitted.status_code == 202, submitted.text
                run_id = submitted.json()["id"]
                assert (
                    client.post("/v1/counties/042/runs", json=request_body, headers=headers).json()[
                        "id"
                    ]
                    == run_id
                )
                assert (
                    client.post(
                        "/v1/counties/042/runs", json=request_body | {"seed": 43}, headers=headers
                    ).status_code
                    == 409
                )
                assert await process_kisumu_one(async_sessionmaker(engine, expire_on_commit=False))
                completed = client.get(f"/v1/counties/042/runs/{run_id}")
                assert completed.status_code == 200 and completed.json()["status"] == "succeeded"
                result = completed.json()["result"]
                assert result["county_code"] == "042"
                assert any(row["facility_id"] == "SYN-KE-042-F001" for row in result["stockouts"])
                trace = client.get(
                    "/v1/counties/042/funding/SYN-042-FLOW-01/trace?seed=42&as_of=2025-04-01"
                )
                assert trace.status_code == 200
                assert trace.json()["synthetic"] is True
                assert trace.json()["bottlenecks"][0]["stage"] == "approved_not_released"
                assert (
                    client.get(
                        "/v1/counties/047/funding/SYN-042-FLOW-01/trace?seed=42&as_of=2025-04-01"
                    ).status_code
                    == 403
                )
                assert client.get(f"/v1/counties/047/runs/{run_id}").status_code == 403
                transfer = result["demo_cases"]["near_expiry_transfer"]
                candidates = [
                    {
                        "id": "transfer",
                        "kind": "redistribution",
                        "cost": 10,
                        "facility_id": transfer["facility_id"],
                        "donor_facility_id": transfer["donor_facility_id"],
                        "commodity_id": transfer["commodity_id"],
                        "quantity": transfer["quantity"],
                        "available_units": transfer["available_units"],
                        "dispatch_day": transfer["dispatch_day"],
                        "arrival_day": transfer["arrival_day"],
                        "expiry_day": transfer["expiry_day"],
                        "minimum_shelf_days": transfer["minimum_shelf_days"],
                        "distance_km": transfer["distance_km"],
                        "max_distance_km": transfer["maximum_distance_km"],
                    }
                ]
                ranked = client.post(
                    f"/v1/counties/042/runs/{run_id}/mitigations",
                    json={
                        "synthetic_attested": True,
                        "budget": 100,
                        "minimum_benefit": 1,
                        "candidates": candidates,
                    },
                )
                assert ranked.status_code == 200, ranked.text
                assert ranked.json()["selected_ids"] == ["transfer"]
                emergency = {
                    "id": "emergency",
                    "kind": "emergency_procurement",
                    "cost": 50,
                    "facility_id": transfer["facility_id"],
                    "commodity_id": transfer["commodity_id"],
                    "quantity": transfer["quantity"],
                    "arrival_day": transfer["arrival_day"],
                }
                compared = client.post(
                    f"/v1/counties/042/runs/{run_id}/mitigations",
                    json={
                        "synthetic_attested": True,
                        "budget": 100,
                        "minimum_benefit": 1,
                        "candidates": [candidates[0], emergency],
                    },
                )
                assert compared.status_code == 200, compared.text
                assert compared.json()["selected_ids"] == ["transfer"]
                assert compared.json()["total_cost"] == 10
                forged = candidates[0] | {"available_units": 999999}
                assert (
                    client.post(
                        f"/v1/counties/042/runs/{run_id}/mitigations",
                        json={
                            "synthetic_attested": True,
                            "budget": 100,
                            "candidates": [forged],
                        },
                    ).status_code
                    == 422
                )
                assert (
                    client.post(
                        f"/v1/counties/047/runs/{run_id}/mitigations",
                        json={
                            "synthetic_attested": True,
                            "budget": 100,
                            "candidates": candidates,
                        },
                    ).status_code
                    == 403
                )
                second = client.post(
                    "/v1/counties/042/runs",
                    json=request_body,
                    headers={"Idempotency-Key": "lease-reclaim-test"},
                )
                assert second.status_code == 202
                sessions = async_sessionmaker(engine, expire_on_commit=False)
                async with sessions.begin() as session:
                    old_claim = await CountyRunRepository(
                        session, country_code="KE", county_code="042"
                    ).claim_next()
                    assert old_claim is not None and old_claim.lease_token is not None
                    old_id, old_lease = old_claim.id, old_claim.lease_token
                    await session.execute(
                        text(
                            "UPDATE county_runs SET lease_until = now() - interval '1 second' "
                            "WHERE id=:id"
                        ),
                        {"id": old_id},
                    )
                async with sessions.begin() as session:
                    repo = CountyRunRepository(session, country_code="KE", county_code="042")
                    new_claim = await repo.claim_next()
                    assert new_claim is not None and new_claim.lease_token is not None
                    assert new_claim.lease_token != old_lease
                    assert not await repo.finish(old_id, old_lease, {"synthetic": True})
                    assert await repo.finish(old_id, new_claim.lease_token, {"synthetic": True})
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
                own_facility = client.get("/v1/counties/042/facilities/SYN-KE-042-F001?seed=42")
                assert own_facility.status_code == 200
                assert own_facility.json()["facility"]["id"] == "SYN-KE-042-F001"
                assert all(
                    item["facility_id"] == "SYN-KE-042-F001"
                    for item in own_facility.json()["stock"]
                )
                assert (
                    client.get("/v1/counties/042/facilities/SYN-KE-042-F002?seed=42").status_code
                    == 403
                )
                assert (
                    client.get("/v1/counties/047/facilities/SYN-KE-042-F001?seed=42").status_code
                    == 403
                )
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
