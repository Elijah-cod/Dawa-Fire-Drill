from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient

from dawa_api.app import create_app
from dawa_api.auth.service import AuthenticationError, authenticate_token, principal_from_claims
from dawa_api.settings import Settings

TEST_SIGNING_MATERIAL = "synthetic-test-material-" * 3
ISSUER = "https://example.invalid/auth/v1"


def token(*, metadata: dict[str, Any], expired: bool = False) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": "synthetic-user",
            "iat": now,
            "exp": now + timedelta(seconds=-1 if expired else 60),
            "iss": ISSUER,
            "aud": "authenticated",
            "app_metadata": metadata,
            "user_metadata": {"role": "admin", "country_code": "ZZ"},
        },
        TEST_SIGNING_MATERIAL,
        algorithm="HS256",
    )


def test_valid_signed_token_uses_server_controlled_metadata() -> None:
    principal = authenticate_token(
        token(metadata={"role": "planner", "country_code": "KE"}),
        signing_secret=TEST_SIGNING_MATERIAL,
        issuer=ISSUER,
    )
    assert (principal.subject, principal.role, principal.country_code) == (
        "synthetic-user",
        "planner",
        "KE",
    )


def test_facility_role_requires_server_controlled_facility_scope() -> None:
    with pytest.raises(AuthenticationError):
        authenticate_token(
            token(metadata={"role": "facility", "country_code": "KE"}),
            signing_secret=TEST_SIGNING_MATERIAL,
            issuer=ISSUER,
        )
    principal = authenticate_token(
        token(metadata={"role": "facility", "country_code": "KE", "facility_id": "SYN-KE-F001"}),
        signing_secret=TEST_SIGNING_MATERIAL,
        issuer=ISSUER,
    )
    assert principal.facility_id == "SYN-KE-F001"


def test_county_and_national_scope_only_come_from_trusted_metadata() -> None:
    scoped = principal_from_claims(
        {
            "sub": "user",
            "app_metadata": {"role": "planner", "country_code": "KE", "county_code": "042"},
            "user_metadata": {"county_code": "047", "national_planning": True},
        }
    )
    assert scoped.county_code == "042"
    assert scoped.national_planning is False
    national = principal_from_claims(
        {
            "sub": "user",
            "app_metadata": {"role": "planner", "country_code": "KE", "national_planning": True},
        }
    )
    assert national.national_planning is True
    for metadata in (
        {"role": "planner", "country_code": "KE", "county_code": "999"},
        {"role": "facility", "country_code": "KE", "facility_id": "f", "national_planning": True},
        {"role": "planner", "country_code": "KE", "national_planning": "true"},
    ):
        with pytest.raises(AuthenticationError):
            principal_from_claims({"sub": "user", "app_metadata": metadata})


def test_county_scoped_users_cannot_access_legacy_country_only_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def allow_request(*args: object, **kwargs: object) -> bool:
        return True

    monkeypatch.setattr("dawa_api.scenarios.router.reserve_request", allow_request)
    settings = Settings(
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/dawa",
        supabase_url="https://example.invalid",
        supabase_jwt_secret=TEST_SIGNING_MATERIAL,
    )
    with TestClient(create_app(settings=settings)) as client:
        for role in ("planner", "pharmacist", "admin", "facility"):
            metadata = {"role": role, "country_code": "KE", "county_code": "042"}
            if role == "facility":
                metadata["facility_id"] = "SYN-KE-042-F001"
            headers = {"Authorization": f"Bearer {token(metadata=metadata)}"}
            for path in (
                "/v1/scenarios",
                "/v1/runs/compare",
                "/v1/catalog/facilities?seed=42",
                "/v1/funding/flows",
                "/v1/captures",
            ):
                assert client.get(path, headers=headers).status_code == 403
        national = {"role": "planner", "country_code": "KE", "national_planning": True}
        assert (
            client.get(
                "/v1/scenarios", headers={"Authorization": f"Bearer {token(metadata=national)}"}
            ).status_code
            == 403
        )


def test_demo_switcher_is_off_by_default_and_forbidden_in_production() -> None:
    url = "postgresql+asyncpg://postgres:postgres@localhost:5432/dawa"
    assert not Settings(DATABASE_URL=url).demo_role_switcher
    with pytest.raises(ValueError):
        Settings(DATABASE_URL=url, app_env="production", demo_role_switcher=True)


def test_demo_switcher_requires_explicit_enablement_and_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def allow_request(*args: object, **kwargs: object) -> bool:
        return True

    monkeypatch.setattr("dawa_api.scenarios.router.reserve_request", allow_request)
    base = dict(
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/dawa",
        supabase_url="https://example.invalid",
        supabase_jwt_secret=TEST_SIGNING_MATERIAL,
    )
    body = {"synthetic_attested": True, "history": [1], "lead_time_periods": 1, "safety_periods": 0}
    admin = {
        "Authorization": f"Bearer {token(metadata={'role': 'admin', 'country_code': 'KE'})}",
        "X-Demo-Role": "facility",
    }
    with TestClient(create_app(settings=Settings(**base))) as client:
        assert client.post("/v1/forecast", json=body, headers=admin).status_code == 403
    with TestClient(create_app(settings=Settings(**base, demo_role_switcher=True))) as client:
        assert client.post("/v1/forecast", json=body, headers=admin).status_code == 403
        admin["X-Demo-Role"] = "planner"
        assert client.post("/v1/forecast", json=body, headers=admin).status_code == 200
        facility_metadata = {
            "role": "facility",
            "country_code": "KE",
            "facility_id": "SYN-KE-042-F001",
        }
        nonadmin = {
            "Authorization": f"Bearer {token(metadata=facility_metadata)}",
            "X-Demo-Role": "planner",
        }
        assert client.post("/v1/forecast", json=body, headers=nonadmin).status_code == 403


def test_demo_capability_reports_server_switcher_state_for_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def allow_request(*args: object, **kwargs: object) -> bool:
        return True

    monkeypatch.setattr("dawa_api.scenarios.router.reserve_request", allow_request)
    base = dict(
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/dawa",
        supabase_url="https://example.invalid",
        supabase_jwt_secret=TEST_SIGNING_MATERIAL,
    )
    headers = {"Authorization": f"Bearer {token(metadata={'role': 'admin', 'country_code': 'KE'})}"}
    for enabled in (False, True):
        with TestClient(
            create_app(settings=Settings(**base, demo_role_switcher=enabled))
        ) as client:
            assert client.get("/v1/demo/capabilities").status_code == 401
            assert client.get("/v1/demo/capabilities", headers=headers).json() == {
                "role_switcher": enabled
            }


@pytest.mark.parametrize(
    "encoded",
    [
        token(metadata={"role": "planner", "country_code": "KE"}, expired=True),
        token(metadata={"role": "owner", "country_code": "KE"}),
        token(metadata={"role": "planner", "country_code": "ZZ"}),
        "invalid",
    ],
)
def test_invalid_expired_or_unauthorized_claims_are_rejected(encoded: str) -> None:
    with pytest.raises(AuthenticationError):
        authenticate_token(encoded, signing_secret=TEST_SIGNING_MATERIAL, issuer=ISSUER)
