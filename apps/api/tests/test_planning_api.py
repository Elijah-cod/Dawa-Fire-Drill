from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from dawa_api.app import create_app
from dawa_api.settings import Settings

SIGNING_MATERIAL = "synthetic-planning-test-" * 3
BASE_URL = "https://example.invalid"


def bearer(role: str = "planner") -> dict[str, str]:
    now = datetime.now(UTC)
    value = jwt.encode(
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
    return {"Authorization": f"Bearer {value}"}


def test_synthetic_planning_endpoints_validate_inputs_and_roles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def allow_request(*args: object, **kwargs: object) -> bool:
        return True

    monkeypatch.setattr("dawa_api.scenarios.router.reserve_request", allow_request)
    settings = Settings(
        DATABASE_URL="postgresql+asyncpg://localhost/dawa",
        supabase_url=BASE_URL,
        supabase_jwt_secret=SIGNING_MATERIAL,
    )
    with TestClient(create_app(settings=settings)) as client:
        forecast = {
            "synthetic_attested": True,
            "history": [10, 20, 30],
            "lead_time_periods": 2,
            "safety_periods": 1,
        }
        response = client.post("/v1/forecast", json=forecast, headers=bearer())
        assert response.status_code == 200 and response.json()["reorder_point"] == 60
        assert response.json()["synthetic"] is True
        assert (
            client.post(
                "/v1/forecast", json=forecast | {"synthetic_attested": 1}, headers=bearer()
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/v1/forecast", json=forecast | {"safety_periods": False}, headers=bearer()
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/v1/forecast", json=forecast | {"history": ["10"]}, headers=bearer()
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/v1/forecast", json=forecast | {"lead_time_periods": 2.0}, headers=bearer()
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/v1/forecast", json=forecast | {"synthetic_attested": False}, headers=bearer()
            ).status_code
            == 422
        )
        transfer = {
            "synthetic_attested": True,
            "source_id": "SYN-KE-F001",
            "target_id": "SYN-KE-F002",
            "available": 10,
            "needed": 7,
            "shelf_life_days": 30,
            "minimum_shelf_life_days": 14,
            "distance_km": 10,
            "max_distance_km": 20,
        }
        response = client.post("/v1/redistribution/suggest", json=transfer, headers=bearer())
        assert response.status_code == 200 and response.json()["quantity"] == 7
        matching = {
            "synthetic_attested": True,
            "commodity_id": "SYN-C01",
            "sources": [{"facility_id": "SYN-KE-F001", "available": 10, "shelf_life_days": 30}],
            "targets": [{"facility_id": "SYN-KE-F002", "needed": 7}],
            "lanes": [{"source_id": "SYN-KE-F001", "target_id": "SYN-KE-F002", "distance_km": 5}],
            "max_distance_km": 20,
            "minimum_shelf_life_days": 14,
        }
        match = client.post("/v1/redistribution/match", json=matching, headers=bearer())
        assert match.status_code == 200
        assert match.json()["synthetic"] is True and match.json()["total_quantity"] == 7
        invalid = matching | {
            "sources": [{"facility_id": "real-facility", "available": 10, "shelf_life_days": 30}]
        }
        assert (
            client.post("/v1/redistribution/match", json=invalid, headers=bearer()).status_code
            == 422
        )
        assert (
            client.post(
                "/v1/redistribution/suggest", json=transfer, headers=bearer("facility")
            ).status_code
            == 403
        )
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
        response = client.post("/v1/funding/trace", json=funding, headers=bearer())
        assert response.status_code == 200
        assert [item["age_days"] for item in response.json()["bottlenecks"]] == [10, 7, 4]
