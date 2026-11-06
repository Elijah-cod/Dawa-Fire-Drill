"""Authenticated, non-secret demo capabilities for the local proxy."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from dawa_api.auth.service import Principal
from dawa_api.scenarios.router import current_principal

router = APIRouter(prefix="/demo", tags=["demo"])


class DemoCapabilities(BaseModel):
    role_switcher: bool


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
