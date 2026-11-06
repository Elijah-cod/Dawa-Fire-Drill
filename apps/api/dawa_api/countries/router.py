"""County-scoped synthetic planning and Kisumu pilot reads."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.auth.service import Principal
from dawa_api.countries.ke.counties import KENYA_COUNTIES, county_by_code
from dawa_api.ingestion.county_repository import COUNTY_GENERATOR_VERSION, CountySnapshotRepository
from dawa_api.scenarios.router import can_plan, session_for_request

router = APIRouter(prefix="/counties", tags=["counties"])
Seed = Annotated[int, Query(ge=-(2**63), le=2**63 - 1)]


class CountyOverviewItem(BaseModel):
    county_code: str
    county_name: str
    planning: dict[str, Any] | None


class CountyOverview(BaseModel):
    synthetic: bool = True
    notice: str = "Illustrative synthetic all-sector planning proxies, not actual county budgets"
    items: list[CountyOverviewItem]


def _check_county(principal: Principal, code: str, *, planning: bool) -> None:
    if principal.country_code != "KE":
        raise HTTPException(status_code=403, detail="Insufficient county scope")
    if principal.county_code != code and not (planning and principal.national_planning):
        raise HTTPException(status_code=403, detail="Insufficient county scope")
    try:
        county_by_code(code)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="County not found") from exc


@router.get("/overview", response_model=CountyOverview)
async def overview(
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    seed: Seed,
    version: Annotated[int, Query(ge=1)] = COUNTY_GENERATOR_VERSION,
) -> CountyOverview:
    if principal.country_code != "KE" or not principal.national_planning:
        raise HTTPException(status_code=403, detail="National planning scope required")
    items: list[CountyOverviewItem] = []
    for county in KENYA_COUNTIES:
        snapshot = await CountySnapshotRepository(
            session, country_code="KE", county_code=county.code
        ).get(seed=seed, kind="planning", version=version)
        items.append(
            CountyOverviewItem(
                county_code=county.code,
                county_name=county.name,
                planning=snapshot.data if snapshot is not None else None,
            )
        )
    return CountyOverview(items=items)


@router.get("/{county_code}/planning")
async def planning(
    county_code: str,
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    seed: Seed,
    version: Annotated[int, Query(ge=1)] = COUNTY_GENERATOR_VERSION,
) -> dict[str, Any]:
    _check_county(principal, county_code, planning=True)
    snapshot = await CountySnapshotRepository(
        session, country_code="KE", county_code=county_code
    ).get(seed=seed, kind="planning", version=version)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Synthetic planning snapshot not found")
    return snapshot.data


@router.get("/{county_code}/pilot")
async def pilot(
    county_code: str,
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    seed: Seed,
    version: Annotated[int, Query(ge=1)] = COUNTY_GENERATOR_VERSION,
) -> dict[str, Any]:
    _check_county(principal, county_code, planning=False)
    if county_code != "042":
        raise HTTPException(status_code=404, detail="Facility pilot is available only in Kisumu")
    snapshot = await CountySnapshotRepository(
        session, country_code="KE", county_code=county_code
    ).get(seed=seed, kind="pilot", version=version)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Synthetic pilot snapshot not found")
    return snapshot.data
