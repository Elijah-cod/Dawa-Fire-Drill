from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from dawa_api.app import create_app
from dawa_api.settings import Settings

SIGNING_MATERIAL = "synthetic-optimizer-test-" * 3
BASE_URL = "https://example.invalid"


def bearer(role: str) -> dict[str, str]:
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


def test_optimizer_endpoint_respects_budget_and_roles(monkeypatch: pytest.MonkeyPatch) -> None:
    async def allow_request(*args: object, **kwargs: object) -> bool:
        return True

    monkeypatch.setattr("dawa_api.scenarios.router.reserve_request", allow_request)
    settings = Settings(
        DATABASE_URL="postgresql+asyncpg://localhost/dawa",
        supabase_url=BASE_URL,
        supabase_jwt_secret=SIGNING_MATERIAL,
    )
    with TestClient(create_app(settings=settings)) as client:
        body = {
            "budget": 5,
            "candidates": [
                {"id": "expensive", "cost": 5, "benefit": 7},
                {"id": "cheap", "cost": 3, "benefit": 7},
            ],
        }
        assert client.post("/v1/optimization/rank", json=body).status_code == 401
        assert (
            client.post("/v1/optimization/rank", json=body, headers=bearer("facility")).status_code
            == 403
        )
        result = client.post("/v1/optimization/rank", json=body, headers=bearer("planner"))
        assert result.status_code == 200
        data = result.json()
        assert data["selected_ids"] == ["cheap"] and data["total_cost"] == 3
        assert data["excluded_reasons"]["expensive"] == "not_selected_by_optimal_set"
        assert data["synthetic"] is True
        assert (
            client.post(
                "/v1/optimization/rank",
                json={"budget": 0, "candidates": []},
                headers=bearer("planner"),
            ).status_code
            == 200
        )
