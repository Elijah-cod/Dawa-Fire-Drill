"""Authenticated synthetic facility and commodity catalog endpoints."""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.auth.service import Principal
from dawa_api.catalog.schemas import CatalogPage, CommodityRead, FacilityRead
from dawa_api.catalog.service import CatalogService
from dawa_api.ingestion.repository import GENERATOR_VERSION
from dawa_api.scenarios.router import can_plan, session_for_request

router = APIRouter(prefix="/catalog", tags=["catalog"])


async def read_page(
    session: AsyncSession,
    principal: Principal,
    *,
    seed: int,
    version: int,
    kind: Literal["facilities", "commodities"],
    limit: int,
    offset: int,
) -> tuple[list[dict[str, Any]], int]:
    result = await CatalogService(session, principal.country_code).page(
        seed=seed, version=version, kind=kind, limit=limit, offset=offset
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Synthetic dataset not found")
    return result


@router.get(
    "/facilities",
    response_model=CatalogPage[FacilityRead],
    responses={404: {"description": "Synthetic dataset not found"}},
)
async def facilities(
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    seed: Annotated[int, Query(ge=-(2**63), lt=2**63)] = 42,
    version: Annotated[int, Query(ge=1)] = GENERATOR_VERSION,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CatalogPage[FacilityRead]:
    items, total = await read_page(
        session,
        principal,
        seed=seed,
        version=version,
        kind="facilities",
        limit=limit,
        offset=offset,
    )
    return CatalogPage[FacilityRead](
        country_code=principal.country_code,
        seed=seed,
        generator_version=version,
        items=[FacilityRead.model_validate(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/commodities",
    response_model=CatalogPage[CommodityRead],
    responses={404: {"description": "Synthetic dataset not found"}},
)
async def commodities(
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    seed: Annotated[int, Query(ge=-(2**63), lt=2**63)] = 42,
    version: Annotated[int, Query(ge=1)] = GENERATOR_VERSION,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CatalogPage[CommodityRead]:
    items, total = await read_page(
        session,
        principal,
        seed=seed,
        version=version,
        kind="commodities",
        limit=limit,
        offset=offset,
    )
    return CatalogPage[CommodityRead](
        country_code=principal.country_code,
        seed=seed,
        generator_version=version,
        items=[CommodityRead.model_validate(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )
