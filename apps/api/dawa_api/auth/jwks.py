"""Verify Supabase asymmetric JWTs against the configured issuer's JWKS."""

import asyncio
from collections.abc import Callable
from time import monotonic
from typing import Any

import httpx
import jwt

from dawa_api.auth.service import AuthenticationError, Principal, principal_from_claims


async def fetch_keys(issuer: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    response = await client.get(f"{issuer.rstrip('/')}/.well-known/jwks.json")
    response.raise_for_status()
    document = response.json()
    if not isinstance(document, dict):
        raise AuthenticationError("Invalid signing keys")
    keys = document.get("keys")
    if not isinstance(keys, list) or len(keys) > 100 or any(not isinstance(x, dict) for x in keys):
        raise AuthenticationError("Invalid signing keys")
    return keys


class JwksCache:
    """Bounded-time cache, shared by requests within one API instance."""

    def __init__(self, *, ttl_seconds: int = 60, clock: Callable[[], float] = monotonic) -> None:
        if ttl_seconds <= 0:
            raise ValueError("JWKS cache lifetime must be positive")
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self.lock = asyncio.Lock()
        self.issuer = ""
        self.expires_at = 0.0
        self.keys: list[dict[str, Any]] = []

    async def get(self, issuer: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
        if self.issuer == issuer and self.clock() < self.expires_at:
            return self.keys
        async with self.lock:
            if self.issuer == issuer and self.clock() < self.expires_at:
                return self.keys
            keys = await fetch_keys(issuer, client)
            self.issuer, self.keys = issuer, keys
            self.expires_at = self.clock() + self.ttl_seconds
            return keys


async def authenticate_jwks(
    token: str, *, issuer: str, client: httpx.AsyncClient, cache: JwksCache | None = None
) -> Principal:
    if not issuer.startswith("https://"):
        raise AuthenticationError("Asymmetric authentication requires an HTTPS issuer")
    try:
        header = jwt.get_unverified_header(token)
        algorithm, key_id = header.get("alg"), header.get("kid")
        if (
            algorithm not in {"ES256", "RS256"}
            or not isinstance(key_id, str)
            or not 1 <= len(key_id) <= 200
        ):
            raise AuthenticationError("Unsupported signing key")
        keys = (
            await cache.get(issuer, client)
            if cache is not None
            else await fetch_keys(issuer, client)
        )
        matches = [
            item
            for item in keys
            if isinstance(item, dict)
            and item.get("kid") == key_id
            and item.get("alg") in (None, algorithm)
            and item.get("use") in (None, "sig")
        ]
        if len(matches) != 1:
            raise AuthenticationError("Signing key not found")
        key = jwt.PyJWK.from_dict(matches[0], algorithm=algorithm)
        claims = jwt.decode(
            token,
            key,
            algorithms=[algorithm],
            audience="authenticated",
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
        return principal_from_claims(claims)
    except (jwt.PyJWTError, httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
        raise AuthenticationError("Invalid credentials") from exc
