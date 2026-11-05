"""Synthetic upload and explicit human-confirmation integration test."""

import asyncio
import os
from datetime import UTC, datetime, timedelta
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import jwt
from alembic.config import Config
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from alembic import command
from dawa_api.app import create_app
from dawa_api.settings import Settings

SIGNING_MATERIAL = "synthetic-capture-test-material-" * 3
BASE_URL = "https://example.invalid"


def bearer(facility_id: str) -> dict[str, str]:
    now = datetime.now(UTC)
    encoded = jwt.encode(
        {
            "sub": "synthetic-user",
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "iss": f"{BASE_URL}/auth/v1",
            "aud": "authenticated",
            "app_metadata": {"role": "facility", "country_code": "KE", "facility_id": facility_id},
        },
        SIGNING_MATERIAL,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {encoded}"}


class FakeProvider:
    calls = 0

    async def extract(self, image: bytes) -> str:
        self.calls += 1
        return (
            '{"commodity_name":"Synthetic item","opening_balance":5,'
            '"closing_balance":3,"record_date":"2026-01-01"}'
        )


def test_capture_requires_synthetic_attestation_and_human_confirmation() -> None:
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
            image = BytesIO()
            Image.new("RGB", (4, 4), "white").save(image, format="PNG")
            file = {"file": ("synthetic.png", image.getvalue(), "image/png")}
            headers = bearer("SYN-KE-F001") | {"Idempotency-Key": "synthetic-capture"}
            fake = FakeProvider()
            with TestClient(create_app(settings=settings, engine=engine)) as client:
                client.app.state.capture_providers = [fake]
                body = {"facility_id": "SYN-KE-F001", "synthetic_attested": "true"}
                oversized = {"file": ("large.png", b"x" * (6 * 1024 * 1024), "image/png")}
                assert (
                    client.post(
                        "/v1/captures", data=body, files=oversized, headers=headers
                    ).status_code
                    == 413
                )
                assert (
                    client.post(
                        "/v1/captures",
                        data=body | {"synthetic_attested": "false"},
                        files=file,
                        headers=headers,
                    ).status_code
                    == 422
                )
                assert (
                    client.post(
                        "/v1/captures",
                        data=body | {"facility_id": "SYN-KE-F002"},
                        files=file,
                        headers=headers,
                    ).status_code
                    == 403
                )
                assert (
                    client.post(
                        "/v1/captures",
                        data=body,
                        files={"file": ("x.png", b"bad", "image/png")},
                        headers=headers,
                    ).status_code
                    == 422
                )
                created = client.post("/v1/captures", data=body, files=file, headers=headers)
                assert created.status_code == 201 and created.json()["status"] == "pending"
                capture_id = created.json()["id"]
                listing = client.get(
                    "/v1/captures?facility_id=SYN-KE-F001&limit=1", headers=headers
                )
                assert listing.status_code == 200 and len(listing.json()["items"]) == 1
                denied = client.get("/v1/captures?facility_id=SYN-KE-F002", headers=headers)
                assert denied.status_code == 404
                replay = client.post("/v1/captures", data=body, files=file, headers=headers)
                assert replay.status_code == 200 and replay.json()["id"] == capture_id
                assert fake.calls == 1
                assert (
                    client.get(
                        f"/v1/captures/{capture_id}", headers=bearer("SYN-KE-F002")
                    ).status_code
                    == 404
                )
                fields = {
                    "commodity_name": "Synthetic item",
                    "opening_balance": 5,
                    "closing_balance": 3,
                    "record_date": "2026-01-01",
                }
                blank = client.post(
                    f"/v1/captures/{capture_id}/confirm",
                    json={"reviewed": True, "fields": fields | {"commodity_name": "   "}},
                    headers=headers,
                )
                assert blank.status_code == 422
                assert (
                    client.post(
                        f"/v1/captures/{capture_id}/confirm",
                        json={"reviewed": False, "fields": fields},
                        headers=headers,
                    ).status_code
                    == 422
                )
                confirmed = client.post(
                    f"/v1/captures/{capture_id}/confirm",
                    json={"reviewed": True, "fields": fields},
                    headers=headers,
                )
                assert confirmed.status_code == 201 and confirmed.json()["synthetic"] is True
                repeated = client.post(
                    f"/v1/captures/{capture_id}/confirm",
                    json={"reviewed": True, "fields": fields},
                    headers=headers,
                )
                assert (
                    repeated.status_code == 200 and repeated.json()["id"] == confirmed.json()["id"]
                )
                conflict = client.post(
                    f"/v1/captures/{capture_id}/confirm",
                    json={"reviewed": True, "fields": fields | {"closing_balance": 4}},
                    headers=headers,
                )
                assert conflict.status_code == 409
                settings.llm_daily_call_cap = 0
                settings.llm_cache_by_image_hash = False
                manual = client.post(
                    "/v1/captures",
                    data=body,
                    files=file,
                    headers=bearer("SYN-KE-F001") | {"Idempotency-Key": "synthetic-manual"},
                )
                assert manual.status_code == 201
                assert manual.json()["provider_status"] == "manual_limit"
                assert fake.calls == 1
        finally:
            await engine.dispose()
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

    asyncio.run(run())
