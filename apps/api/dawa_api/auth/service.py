"""Validate legacy Supabase HS256 JWTs and trusted application metadata."""

from dataclasses import dataclass
from typing import Literal, cast

import jwt

from dawa_api.countries.service import CountryNotConfigured, get_country

Role = Literal["planner", "pharmacist", "facility", "admin"]
ROLES = frozenset({"planner", "pharmacist", "facility", "admin"})


class AuthenticationError(ValueError):
    """Credentials or required claims are invalid."""


@dataclass(frozen=True)
class Principal:
    subject: str
    role: Role
    country_code: str


def authenticate_token(token: str, *, signing_secret: str, issuer: str) -> Principal:
    if not signing_secret or not issuer:
        raise AuthenticationError("Authentication is not configured")
    try:
        claims = jwt.decode(
            token,
            signing_secret,
            algorithms=["HS256"],
            audience="authenticated",
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
        metadata = claims.get("app_metadata")
        if not isinstance(metadata, dict):
            raise AuthenticationError("Missing application metadata")
        role, country = metadata.get("role"), metadata.get("country_code")
        subject = claims.get("sub")
        if (
            not isinstance(subject, str)
            or not subject
            or not isinstance(role, str)
            or role not in ROLES
        ):
            raise AuthenticationError("Invalid subject or role")
        if not isinstance(country, str):
            raise AuthenticationError("Missing country")
        country_code = get_country(country).code
        return Principal(subject=subject, role=cast(Role, role), country_code=country_code)
    except (jwt.InvalidTokenError, CountryNotConfigured) as exc:
        raise AuthenticationError("Invalid credentials") from exc
