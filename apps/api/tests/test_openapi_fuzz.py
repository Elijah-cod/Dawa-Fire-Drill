"""Fuzz synthetic forecast validation against the published OpenAPI contract."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import jwt
import schemathesis
from hypothesis import settings

from dawa_api.app import create_app
from dawa_api.settings import Settings

TEST_KEY = "synthetic-fuzz-signing-material-" * 3
ISSUER = "https://example.invalid/auth/v1"
app = create_app(
    settings=Settings(
        DATABASE_URL="postgresql+asyncpg://localhost/dawa",
        supabase_url="https://example.invalid",
        supabase_jwt_secret=TEST_KEY,
    )
)
schema = schemathesis.openapi.from_asgi("/openapi.json", app).include(path="/v1/forecast")


@schema.auth()
class SyntheticAuth:
    def get(self, case, context):
        now = datetime.now(UTC)
        return jwt.encode(
            {
                "sub": "synthetic-fuzz",
                "iat": now,
                "exp": now + timedelta(minutes=5),
                "iss": ISSUER,
                "aud": "authenticated",
                "app_metadata": {"role": "planner", "country_code": "KE"},
            },
            TEST_KEY,
            algorithm="HS256",
        )

    def set(self, case, data, context):
        case.headers = case.headers or {}
        case.headers["Authorization"] = f"Bearer {data}"


async def allow_request(*args, **kwargs):
    return True


@schema.parametrize()
@settings(max_examples=30, deadline=None)
def test_forecast_openapi_contract(case):
    with patch("dawa_api.scenarios.router.reserve_request", allow_request):
        case.call_and_validate()
