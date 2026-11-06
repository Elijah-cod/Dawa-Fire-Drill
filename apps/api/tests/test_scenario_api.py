"""Authenticated API behavior against an isolated local Postgres schema."""

import asyncio
import os
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import jwt
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from alembic import command
from dawa_api.app import create_app
from dawa_api.finance_flow.repository import refresh_diagnostics
from dawa_api.jobs.worker import process_one
from dawa_api.settings import Settings

SIGNING_MATERIAL = "synthetic-api-test-material-" * 3
BASE_URL = "https://example.invalid"


def bearer(role: str) -> dict[str, str]:
    now = datetime.now(UTC)
    encoded = jwt.encode(
        {
            "sub": "synthetic-user",
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "iss": f"{BASE_URL}/auth/v1",
            "aud": "authenticated",
            "app_metadata": {"role": role, "country_code": "KE", "facility_id": "SYN-KE-F001"},
        },
        SIGNING_MATERIAL,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {encoded}"}


def test_scenario_api_auth_roles_idempotency_and_pagination() -> None:
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
            settings = Settings(
                DATABASE_URL=url, supabase_url=BASE_URL, supabase_jwt_secret=SIGNING_MATERIAL
            )
            limited_settings = Settings(
                DATABASE_URL=url,
                supabase_url=BASE_URL,
                supabase_jwt_secret=SIGNING_MATERIAL,
                rate_limit_per_minute=1,
            )
            with TestClient(create_app(settings=limited_settings, engine=engine)) as limited:
                assert limited.get("/v1/scenarios", headers=bearer("planner")).status_code == 200
                assert limited.get("/v1/scenarios", headers=bearer("planner")).status_code == 429
            with TestClient(create_app(settings=limited_settings, engine=engine)) as another:
                assert another.get("/v1/scenarios", headers=bearer("planner")).status_code == 429
            with TestClient(create_app(settings=settings, engine=engine)) as client:
                assert client.get("/v1/scenarios").status_code == 401
                body = {
                    "name": "Synthetic shock",
                    "shock_type": "logistics_reduction",
                    "magnitude": 40,
                }
                headers = bearer("planner") | {"Idempotency-Key": "synthetic-run-1"}
                assert (
                    client.post("/v1/scenarios", json=body, headers=bearer("facility")).status_code
                    == 403
                )
                created = client.post("/v1/scenarios", json=body, headers=headers)
                assert created.status_code == 201
                replay = client.post("/v1/scenarios", json=body, headers=headers)
                assert replay.status_code == 200 and replay.json()["id"] == created.json()["id"]
                assert (
                    client.post(
                        "/v1/scenarios", json=body | {"magnitude": 41}, headers=headers
                    ).status_code
                    == 409
                )
                listing = client.get("/v1/scenarios?limit=1&offset=0", headers=bearer("pharmacist"))
                assert listing.status_code == 200 and len(listing.json()["items"]) == 1
                assert client.get("/v1/scenarios", headers=bearer("facility")).status_code == 403
                assert (
                    client.get(
                        f"/v1/scenarios/{created.json()['id']}", headers=bearer("planner")
                    ).status_code
                    == 200
                )
                run_headers = bearer("planner") | {"Idempotency-Key": "synthetic-job-1"}
                submitted = client.post(
                    f"/v1/scenarios/{created.json()['id']}/runs",
                    json={"seed": 42, "horizon_days": 90},
                    headers=run_headers,
                )
                assert submitted.status_code == 202
                run_id = submitted.json()["id"]
                assert (
                    client.get(f"/v1/runs/{run_id}", headers=bearer("facility")).status_code == 403
                )
                assert (
                    client.get(
                        f"/v1/scenarios/{created.json()['id']}/runs", headers=bearer("facility")
                    ).status_code
                    == 403
                )
                replay_run = client.post(
                    f"/v1/scenarios/{created.json()['id']}/runs",
                    json={"seed": 42, "horizon_days": 90},
                    headers=run_headers,
                )
                assert replay_run.status_code == 200 and replay_run.json()["id"] == run_id
                assert await process_one(async_sessionmaker(engine, expire_on_commit=False), "KE")
                result = client.get(f"/v1/runs/{run_id}", headers=bearer("planner"))
                assert result.status_code == 200
                assert result.json()["status"] == "succeeded"
                assert result.json()["result"]["synthetic"] is True
                facilities = client.get(
                    "/v1/catalog/facilities?seed=42&limit=3&offset=0", headers=bearer("planner")
                )
                assert facilities.status_code == 200
                assert facilities.json()["synthetic"] is True
                assert len(facilities.json()["items"]) == 3
                final_page = client.get(
                    "/v1/catalog/facilities?seed=42&limit=10&offset=39", headers=bearer("planner")
                )
                assert final_page.json()["total"] == 40 and len(final_page.json()["items"]) == 1
                commodities = client.get(
                    "/v1/catalog/commodities?seed=42", headers=bearer("pharmacist")
                )
                assert commodities.status_code == 200 and len(commodities.json()["items"]) == 10
                assert (
                    client.get(
                        "/v1/catalog/facilities?seed=999", headers=bearer("planner")
                    ).status_code
                    == 404
                )
                assert (
                    client.get(
                        "/v1/catalog/facilities?seed=42", headers=bearer("facility")
                    ).status_code
                    == 403
                )
                stockout = result.json()["result"]["stockouts"][0]
                mitigation = {
                    "synthetic_attested": True,
                    "budget": 100,
                    "candidates": [
                        {
                            "id": "emergency-1",
                            "kind": "emergency_procurement",
                            "facility_id": stockout["facility_id"],
                            "commodity_id": stockout["commodity_id"],
                            "cost": 40,
                            "benefit": 10,
                        },
                        {
                            "id": "reorder-1",
                            "kind": "reorder_timing",
                            "facility_id": stockout["facility_id"],
                            "commodity_id": stockout["commodity_id"],
                            "cost": 30,
                            "benefit": 10,
                        },
                    ],
                }
                ranking = client.post(
                    f"/v1/runs/{run_id}/mitigations", json=mitigation, headers=bearer("planner")
                )
                assert ranking.status_code == 200
                assert ranking.json()["selected_ids"] == ["reorder-1"]
                assert ranking.json()["excluded_reasons"]["emergency-1"] == "alternative_selected"
                assert ranking.json()["run_id"] == run_id
                targeted = client.post(
                    f"/v1/runs/{run_id}/mitigations",
                    json=mitigation | {"minimum_benefit": 10},
                    headers=bearer("planner"),
                )
                assert targeted.status_code == 200
                assert targeted.json()["selected_ids"] == ["reorder-1"]
                assert targeted.json()["minimum_benefit"] == 10
                unreachable = client.post(
                    f"/v1/runs/{run_id}/mitigations",
                    json=mitigation | {"minimum_benefit": 11},
                    headers=bearer("planner"),
                )
                assert unreachable.status_code == 409
                modeled = client.post(
                    f"/v1/runs/{run_id}/modeled-mitigations",
                    json={
                        "synthetic_attested": True,
                        "budget": 50,
                        "candidates": [
                            {
                                "id": "emergency-modeled",
                                "facility_id": stockout["facility_id"],
                                "commodity_id": stockout["commodity_id"],
                                "cost": 20,
                                "arrival_day": 1,
                                "quantity": 100000,
                            },
                            {
                                "id": "late",
                                "facility_id": stockout["facility_id"],
                                "commodity_id": stockout["commodity_id"],
                                "cost": 1,
                                "arrival_day": stockout["day"] + 1,
                                "quantity": 100000,
                            },
                        ],
                    },
                    headers=bearer("planner"),
                )
                assert modeled.status_code == 200, modeled.text
                assert modeled.json()["selected_ids"] == ["emergency-modeled"]
                effect = modeled.json()["effects"][0]
                assert effect["baseline_stockout_day"] == stockout["day"]
                assert effect["deferred_days"] > 0
                assert modeled.json()["effects"][1]["deferred_days"] == 0
                unknown = mitigation | {
                    "candidates": [mitigation["candidates"][0] | {"facility_id": "unknown"}]
                }
                assert (
                    client.post(
                        f"/v1/runs/{run_id}/mitigations", json=unknown, headers=bearer("planner")
                    ).status_code
                    == 422
                )
                assert not await process_one(
                    async_sessionmaker(engine, expire_on_commit=False), "KE"
                )
                runs = client.get(
                    f"/v1/scenarios/{created.json()['id']}/runs?limit=1&offset=0",
                    headers=bearer("planner"),
                )
                assert runs.status_code == 200 and len(runs.json()["items"]) == 1
                comparison_run = client.post(
                    f"/v1/scenarios/{created.json()['id']}/runs",
                    json={"seed": 7, "horizon_days": 90},
                    headers=bearer("planner") | {"Idempotency-Key": "comparison-job"},
                )
                comparison_id = comparison_run.json()["id"]
                assert (
                    client.get(
                        f"/v1/runs/compare?left={run_id}&right={comparison_id}",
                        headers=bearer("planner"),
                    ).status_code
                    == 409
                )
                assert await process_one(async_sessionmaker(engine, expire_on_commit=False), "KE")
                comparison = client.get(
                    f"/v1/runs/compare?left={run_id}&right={comparison_id}",
                    headers=bearer("planner"),
                )
                assert comparison.status_code == 200
                assert comparison.json()["left"]["id"] == run_id
                assert comparison.json()["right"]["id"] == comparison_id
                assert (
                    client.get(
                        f"/v1/runs/compare?left={run_id}&right={run_id}", headers=bearer("planner")
                    ).status_code
                    == 422
                )
                assert (
                    client.get(
                        f"/v1/runs/compare?left={run_id}&right={uuid4()}", headers=bearer("planner")
                    ).status_code
                    == 404
                )
                legacy = client.post(
                    f"/v1/scenarios/{created.json()['id']}/runs",
                    json={"seed": 42, "horizon_days": 90},
                    headers=bearer("planner") | {"Idempotency-Key": "legacy-job"},
                )
                legacy_id = legacy.json()["id"]
                async with engine.begin() as connection:
                    await connection.execute(
                        text("UPDATE scenario_runs SET simulation_version = 1 WHERE id = :id"),
                        {"id": UUID(legacy_id)},
                    )
                assert await process_one(async_sessionmaker(engine, expire_on_commit=False), "KE")
                legacy_result = client.get(
                    f"/v1/runs/{legacy_id}", headers=bearer("planner")
                ).json()
                assert legacy_result["simulation_version"] == 1
                assert "district_stockouts" not in legacy_result["result"]
                failed = client.post(
                    f"/v1/scenarios/{created.json()['id']}/runs",
                    json={"seed": 42, "horizon_days": 90},
                    headers=bearer("planner") | {"Idempotency-Key": "synthetic-job-2"},
                )

                def broken_simulator(*args: object, **kwargs: object) -> None:
                    raise RuntimeError("internal error must not be exposed")

                assert await process_one(
                    async_sessionmaker(engine, expire_on_commit=False),
                    "KE",
                    simulator=broken_simulator,
                )
                failure = client.get(f"/v1/runs/{failed.json()['id']}", headers=bearer("planner"))
                assert failure.json()["status"] == "failed"
                assert failure.json()["error"] == "Scenario run failed"
                funding = {
                    "synthetic_attested": True,
                    "approved": 100,
                    "released": 80,
                    "procured": 50,
                    "delivered": 40,
                    "approved_on": "2026-01-01",
                    "released_on": "2026-01-04",
                    "procured_on": "2026-01-07",
                    "delivered_on": "2026-01-09",
                    "as_of": "2026-01-11",
                }
                funding_headers = bearer("planner") | {"Idempotency-Key": "synthetic-funding"}
                flow = client.post("/v1/funding/flows", json=funding, headers=funding_headers)
                assert flow.status_code == 201
                assert (
                    client.post(
                        "/v1/funding/flows", json=funding, headers=funding_headers
                    ).status_code
                    == 200
                )
                trace = client.get(
                    f"/v1/funding/flows/{flow.json()['id']}/trace?as_of=2026-01-11",
                    headers=bearer("pharmacist"),
                )
                assert trace.status_code == 200 and trace.json()["bottlenecks"][0]["age_days"] == 10
                flows = client.get("/v1/funding/flows?limit=1", headers=bearer("planner"))
                assert flows.status_code == 200 and len(flows.json()["items"]) == 1
                assert (
                    await refresh_diagnostics(
                        async_sessionmaker(engine, expire_on_commit=False),
                        country_code="KE",
                        as_of=date(2026, 1, 11),
                    )
                    == 1
                )
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
