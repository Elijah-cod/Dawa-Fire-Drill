from datetime import UTC, datetime, timedelta

import jwt
import pytest

from dawa_api.auth.service import AuthenticationError, authenticate_token, principal_from_claims

TEST_SIGNING_MATERIAL = "synthetic-test-material-" * 3
ISSUER = "https://example.invalid/auth/v1"


def token(*, metadata: dict[str, str], expired: bool = False) -> str:
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
