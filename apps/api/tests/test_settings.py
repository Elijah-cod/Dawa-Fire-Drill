from contextlib import nullcontext

import pytest
from pydantic import ValidationError

from dawa_api.settings import Settings


def test_settings_names_missing_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings()


def test_settings_accepts_local_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://localhost/dawa")
    with nullcontext():
        settings = Settings()
    assert settings.database_url == "postgresql+asyncpg://localhost/dawa"
    assert settings.synthetic_seed == 42


def test_settings_rejects_non_postgres_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///test.db")
    with pytest.raises(ValidationError, match="Postgres"):
        Settings()
