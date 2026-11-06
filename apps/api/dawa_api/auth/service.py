"""Validate trusted JWT claims and legacy Supabase HS256 signatures."""

import re
from dataclasses import dataclass
from typing import Any, Literal, cast

import jwt

from dawa_api.countries.ke.counties import county_by_code
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
    facility_id: str | None = None
    county_code: str | None = None
    national_planning: bool = False


def principal_from_claims(claims: dict[str, Any]) -> Principal:
    metadata = claims.get("app_metadata")
    if not isinstance(metadata, dict):
        raise AuthenticationError("Missing application metadata")
    role, country = metadata.get("role"), metadata.get("country_code")
    subject = claims.get("sub")
    if (
        not isinstance(subject, str)
        or not 1 <= len(subject) <= 200
        or not isinstance(role, str)
        or role not in ROLES
    ):
        raise AuthenticationError("Invalid subject or role")
    if not isinstance(country, str):
        raise AuthenticationError("Missing country")
    try:
        country_code = get_country(country).code
    except CountryNotConfigured as exc:
        raise AuthenticationError("Invalid country") from exc
    facility = metadata.get("facility_id")
    if facility is not None and (
        not isinstance(facility, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", facility)
    ):
        raise AuthenticationError("Invalid facility scope")
    if role == "facility" and facility is None:
        raise AuthenticationError("Facility scope is required")
    county = metadata.get("county_code")
    if county is not None:
        if not isinstance(county, str) or country_code != "KE":
            raise AuthenticationError("Invalid county scope")
        try:
            county_by_code(county)
        except ValueError as exc:
            raise AuthenticationError("Invalid county scope") from exc
    national = metadata.get("national_planning", False)
    if type(national) is not bool or (national and role not in {"planner", "admin"}):
        raise AuthenticationError("Invalid national planning scope")
    return Principal(
        subject=subject,
        role=cast(Role, role),
        country_code=country_code,
        facility_id=facility,
        county_code=county,
        national_planning=national,
    )


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
        return principal_from_claims(claims)
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Invalid credentials") from exc
