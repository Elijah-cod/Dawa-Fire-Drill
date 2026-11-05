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


def test_readiness_reports_database_failure_without_details(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://localhost/dawa")
    with TestClient(create_app()) as client:

        class FailedSession:
            async def __aenter__(self):
                raise RuntimeError("sensitive database detail")

            async def __aexit__(self, *args):
                return False

        client.app.state.sessions = lambda: FailedSession()
        response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unavailable"}


def test_readiness_checks_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://localhost/dawa")
    with TestClient(create_app()) as client:

        class ReadySession:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def execute(self, statement):
                assert str(statement) == "SELECT 1"

        client.app.state.sessions = lambda: ReadySession()
        response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "ready"}


def test_request_id_and_structured_log_omit_query_and_token(
    monkeypatch: pytest.MonkeyPatch, caplog
) -> None:
    import json
    import logging
    from uuid import UUID

    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://localhost/dawa")
    with (
        caplog.at_level(logging.INFO, logger="dawa_api.requests"),
        TestClient(create_app()) as client,
    ):
        response = client.get(
            "/health?secret=do-not-log", headers={"Authorization": "Bearer do-not-log"}
        )
    request_id = response.headers["x-request-id"]
    assert str(UUID(request_id)) == request_id
    records = [
        json.loads(record.message)
        for record in caplog.records
        if record.name == "dawa_api.requests"
    ]
    assert records[-1]["request_id"] == request_id
    assert records[-1]["path"] == "/health" and records[-1]["status"] == 200
    assert "do-not-log" not in str(records)
