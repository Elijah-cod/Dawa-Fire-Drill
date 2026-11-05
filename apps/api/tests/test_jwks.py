import asyncio
import json
from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from dawa_api.auth.jwks import authenticate_jwks
from dawa_api.auth.service import AuthenticationError


def test_es256_jwks_validates_signature_and_trusted_claims():
    async def check():
        key = ec.generate_private_key(ec.SECP256R1())
        public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(key.public_key()))
        public.update({"kid": "synthetic-key", "alg": "ES256", "use": "sig"})
        now = datetime.now(UTC)
        claims = {
            "sub": "synthetic-user",
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "iss": "https://example.invalid/auth/v1",
            "aud": "authenticated",
            "app_metadata": {"role": "planner", "country_code": "KE"},
        }
        token = jwt.encode(claims, key, algorithm="ES256", headers={"kid": "synthetic-key"})

        async def handle(request):
            assert request.url.path == "/auth/v1/.well-known/jwks.json"
            return httpx.Response(200, json={"keys": [public]})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            principal = await authenticate_jwks(token, issuer=claims["iss"], client=client)
            assert principal.subject == "synthetic-user" and principal.role == "planner"
            with pytest.raises(AuthenticationError):
                await authenticate_jwks(
                    token, issuer="https://other.invalid/auth/v1", client=client
                )
            other = ec.generate_private_key(ec.SECP256R1())
            forged = jwt.encode(claims, other, algorithm="ES256", headers={"kid": "synthetic-key"})
            with pytest.raises(AuthenticationError):
                await authenticate_jwks(forged, issuer=claims["iss"], client=client)
            unknown = jwt.encode(claims, key, algorithm="ES256", headers={"kid": "unknown"})
            with pytest.raises(AuthenticationError):
                await authenticate_jwks(unknown, issuer=claims["iss"], client=client)

    asyncio.run(check())


def test_api_accepts_asymmetric_token(monkeypatch):
    from fastapi.testclient import TestClient

    from dawa_api.app import create_app
    from dawa_api.settings import Settings

    async def allow(*args, **kwargs):
        return True

    monkeypatch.setattr("dawa_api.scenarios.router.reserve_request", allow)
    key = ec.generate_private_key(ec.SECP256R1())
    public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(key.public_key()))
    public.update({"kid": "test-key", "alg": "ES256", "use": "sig"})
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": "synthetic-user",
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "iss": "https://example.invalid/auth/v1",
            "aud": "authenticated",
            "app_metadata": {"role": "planner", "country_code": "KE"},
        },
        key,
        algorithm="ES256",
        headers={"kid": "test-key"},
    )
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"keys": [public]}))
    settings = Settings(
        DATABASE_URL="postgresql+asyncpg://localhost/dawa", supabase_url="https://example.invalid"
    )
    with TestClient(create_app(settings=settings)) as client:
        client.app.state.http_client = httpx.AsyncClient(transport=transport)
        response = client.post(
            "/v1/forecast",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "synthetic_attested": True,
                "history": [10, 20],
                "lead_time_periods": 2,
                "safety_periods": 1,
            },
        )
        assert response.status_code == 200


def test_jwks_cache_limits_fetches_and_expires_revoked_keys():
    from dawa_api.auth.jwks import JwksCache

    async def check():
        key = ec.generate_private_key(ec.SECP256R1())
        public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(key.public_key()))
        public.update({"kid": "cached-key", "alg": "ES256", "use": "sig"})
        now = datetime.now(UTC)
        claims = {
            "sub": "synthetic-user",
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "iss": "https://example.invalid/auth/v1",
            "aud": "authenticated",
            "app_metadata": {"role": "planner", "country_code": "KE"},
        }
        token = jwt.encode(claims, key, algorithm="ES256", headers={"kid": "cached-key"})
        clock = [0.0]
        calls = []

        async def handle(request):
            calls.append(request)
            return httpx.Response(200, json={"keys": [public] if len(calls) == 1 else []})

        cache = JwksCache(ttl_seconds=60, clock=lambda: clock[0])
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            await asyncio.gather(
                *[
                    authenticate_jwks(token, issuer=claims["iss"], client=client, cache=cache)
                    for _ in range(3)
                ]
            )
            assert len(calls) == 1
            clock[0] = 61.0
            with pytest.raises(AuthenticationError):
                await authenticate_jwks(token, issuer=claims["iss"], client=client, cache=cache)
            assert len(calls) == 2

    asyncio.run(check())


def test_expired_jwks_cache_does_not_serve_keys_during_outage():
    from dawa_api.auth.jwks import JwksCache

    async def check():
        clock = [0.0]
        calls = []

        async def handle(request):
            calls.append(request)
            if len(calls) == 1:
                return httpx.Response(200, json={"keys": [{"kid": "synthetic"}]})
            raise httpx.ConnectError("offline", request=request)

        cache = JwksCache(ttl_seconds=60, clock=lambda: clock[0])
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            assert await cache.get("https://example.invalid/auth/v1", client)
            clock[0] = 59.0
            assert await cache.get("https://example.invalid/auth/v1", client)
            assert len(calls) == 1
            clock[0] = 60.0
            with pytest.raises(httpx.ConnectError):
                await cache.get("https://example.invalid/auth/v1", client)

    asyncio.run(check())
