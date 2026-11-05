"""Verify Supabase asymmetric JWTs against the configured issuer's JWKS."""

import httpx
import jwt

from dawa_api.auth.service import AuthenticationError, Principal, principal_from_claims


async def authenticate_jwks(token: str, *, issuer: str, client: httpx.AsyncClient) -> Principal:
    if not issuer.startswith("https://"):
        raise AuthenticationError("Asymmetric authentication requires an HTTPS issuer")
    try:
        header = jwt.get_unverified_header(token)
        algorithm, key_id = header.get("alg"), header.get("kid")
        if algorithm not in {"ES256", "RS256"} or not isinstance(key_id, str) or len(key_id) > 200:
            raise AuthenticationError("Unsupported signing key")
        response = await client.get(f"{issuer.rstrip('/')}/.well-known/jwks.json")
        response.raise_for_status()
        keys = response.json().get("keys", [])
        if not isinstance(keys, list) or len(keys) > 100:
            raise AuthenticationError("Invalid signing keys")
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
