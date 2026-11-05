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
            "synthetic_attested": True,
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
        assert "illustrative and unvalidated" in data["explanation"].lower()
        assert "cheap" in data["explanation"]

        async def reserve(*args: object, **kwargs: object) -> bool:
            return True

        class FakeExplainer:
            async def explain(self, payload: dict[str, object]) -> str:
                assert payload["selected_ids"] == ["cheap"]
                return '{"text":"The chosen option fits the budget."}'

        monkeypatch.setattr("dawa_api.capture.repository.PostgresExtractionStore.reserve", reserve)
        client.app.state.explanation_providers = [FakeExplainer()]
        llm_result = client.post(
            "/v1/optimization/rank",
            json=body | {"include_llm_explanation": True},
            headers=bearer("planner"),
        )
        assert llm_result.json()["selected_ids"] == ["cheap"]
        assert "chosen option fits" in llm_result.json()["explanation"]
        assert (
            client.post(
                "/v1/optimization/rank",
                json={"synthetic_attested": True, "budget": 0, "candidates": []},
                headers=bearer("planner"),
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/v1/optimization/rank",
                json=body | {"synthetic_attested": 1},
                headers=bearer("planner"),
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/v1/optimization/rank", json=body | {"budget": True}, headers=bearer("planner")
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/v1/optimization/rank",
                json=body | {"include_llm_explanation": 0},
                headers=bearer("planner"),
            ).status_code
            == 422
        )
        duplicate = body | {"candidates": [body["candidates"][0], body["candidates"][0]]}
        assert (
            client.post(
                "/v1/optimization/rank", json=duplicate, headers=bearer("planner")
            ).status_code
            == 409
        )

        def unavailable(*args: object, **kwargs: object) -> None:
            raise RuntimeError("internal solver detail")

        monkeypatch.setattr("dawa_api.optimization.router.select_actions", unavailable)
        response = client.post("/v1/optimization/rank", json=body, headers=bearer("planner"))
        assert response.status_code == 503
        assert "internal solver detail" not in response.text
        assert (
            client.post(
                "/v1/optimization/rank",
                json={"budget": 0, "candidates": []},
                headers=bearer("planner"),
            ).status_code
            == 422
        )
