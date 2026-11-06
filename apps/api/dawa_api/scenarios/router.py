"""Authenticated, country-scoped scenario endpoints."""

from collections.abc import AsyncIterator
from typing import Annotated, cast
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from dawa_api.auth.jwks import authenticate_jwks
from dawa_api.auth.limits import reserve_request
from dawa_api.auth.service import AuthenticationError, Principal, Role, authenticate_token
from dawa_api.scenarios.schemas import ScenarioCreate, ScenarioPage, ScenarioRead
from dawa_api.scenarios.service import ScenarioService
from dawa_api.settings import Settings
from dawa_api.storage.scenarios import IdempotencyConflict

router = APIRouter(prefix="/scenarios", tags=["scenarios"])
bearer = HTTPBearer(auto_error=False)


async def current_principal(
    request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> Principal:
    settings: Settings = request.app.state.settings
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        token = credentials.credentials
        issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1" if settings.supabase_url else ""
        algorithm = jwt.get_unverified_header(token).get("alg")
        if algorithm == "HS256":
            principal = authenticate_token(
                token, signing_secret=settings.supabase_jwt_secret, issuer=issuer
            )
        else:
            principal = await authenticate_jwks(
                token,
                issuer=issuer,
                client=request.app.state.http_client,
                cache=request.app.state.jwks_cache,
            )
    except (AuthenticationError, jwt.PyJWTError) as exc:
        raise HTTPException(
            status_code=401, detail="Invalid credentials", headers={"WWW-Authenticate": "Bearer"}
        ) from exc
    demo_role = request.headers.get("X-Demo-Role")
    if demo_role is not None:
        if (
            not settings.demo_role_switcher
            or settings.app_env == "production"
            or principal.role != "admin"
        ):
            raise HTTPException(status_code=403, detail="Demo role switching unavailable")
        if demo_role not in {"national", "planner", "pharmacist", "facility"}:
            raise HTTPException(status_code=400, detail="Unknown demo role")
        principal = Principal(
            subject=principal.subject,
            role="planner" if demo_role == "national" else cast(Role, demo_role),
            country_code="KE",
            county_code=None if demo_role == "national" else "042",
            national_planning=demo_role == "national",
            facility_id="SYN-KE-042-F001" if demo_role == "facility" else None,
        )
    # County-aware identities cannot enter older storage paths until those paths
    # have county-level tenancy. The separate county API enforces both scopes.
    path = request.url.path.removeprefix(settings.api_prefix.rstrip("/"))
    legacy_prefixes = ("/scenarios", "/runs", "/catalog", "/funding", "/captures")
    if (principal.county_code is not None or principal.national_planning) and any(
        path == prefix or path.startswith(prefix + "/") for prefix in legacy_prefixes
    ):
        raise HTTPException(
            status_code=403, detail="Legacy country-only path unavailable for county scope"
        )
    if not await reserve_request(
        request.app.state.sessions, principal, limit=settings.rate_limit_per_minute
    ):
        raise HTTPException(
            status_code=429, detail="Rate limit exceeded", headers={"Retry-After": "60"}
        )
    return principal


def can_create(principal: Annotated[Principal, Depends(current_principal)]) -> Principal:
    if principal.role not in {"planner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient role")
    return principal


def can_plan(principal: Annotated[Principal, Depends(current_principal)]) -> Principal:
    if principal.role not in {"planner", "pharmacist", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient role")
    return principal


async def session_for_request(request: Request) -> AsyncIterator[AsyncSession]:
    factory: async_sessionmaker[AsyncSession] = request.app.state.sessions
    async with factory() as session, session.begin():
        yield session


@router.post("", response_model=ScenarioRead, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    data: ScenarioCreate,
    response: Response,
    principal: Annotated[Principal, Depends(can_create)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=128)],
) -> ScenarioRead:
    try:
        scenario, created = await ScenarioService(session, principal.country_code).create(key, data)
    except IdempotencyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    response.status_code = 201 if created else 200
    return ScenarioRead.model_validate(scenario)


@router.get("", response_model=ScenarioPage)
async def list_scenarios(
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ScenarioPage:
    scenarios = await ScenarioService(session, principal.country_code).list_page(limit, offset)
    return ScenarioPage(
        items=[ScenarioRead.model_validate(x) for x in scenarios], limit=limit, offset=offset
    )


@router.get("/{scenario_id}", response_model=ScenarioRead)
async def get_scenario(
    scenario_id: UUID,
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> ScenarioRead:
    scenario = await ScenarioService(session, principal.country_code).get(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return ScenarioRead.model_validate(scenario)
