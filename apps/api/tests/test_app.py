import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from dawa_api.app import create_app


def test_health_reports_synthetic_data_notice(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://localhost/dawa")
    with TestClient(create_app()) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "data_policy": "synthetic data; model outputs illustrative and unvalidated",
    }


def test_api_docs_label_synthetic_and_unvalidated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://localhost/dawa")
    with TestClient(create_app()) as client:
        description = client.get("/openapi.json").json()["info"]["description"]
    assert "synthetic" in description
    assert "illustrative and unvalidated" in description


def test_app_fails_fast_without_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError, match="DATABASE_URL"), TestClient(create_app()):
        pass
