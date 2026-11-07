"""Authenticated, non-secret demo capabilities for the local proxy."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from dawa_api.auth.service import Principal, Role
from dawa_api.scenarios.router import current_principal

router = APIRouter(prefix="/demo", tags=["demo"])


class DemoCapabilities(BaseModel):
    role_switcher: bool


class DemoSession(BaseModel):
    role: Role
    country_code: str
    county_code: str | None
    facility_id: str | None
    national_planning: bool


@router.get("/session", response_model=DemoSession)
async def session(principal: Annotated[Principal, Depends(current_principal)]) -> DemoSession:
    return DemoSession(
        role=principal.role,
        country_code=principal.country_code,
        county_code=principal.county_code,
        facility_id=principal.facility_id,
        national_planning=principal.national_planning,
    )


@router.get("/capabilities", response_model=DemoCapabilities)
async def capabilities(
    request: Request, principal: Annotated[Principal, Depends(current_principal)]
) -> DemoCapabilities:
    settings = request.app.state.settings
    return DemoCapabilities(
        role_switcher=(
            settings.demo_role_switcher
            and settings.app_env != "production"
            and principal.role == "admin"
        )
    )
