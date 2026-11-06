"""County-scoped synthetic planning and Kisumu pilot reads."""

import asyncio
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.auth.service import Principal
from dawa_api.countries.facility_view import facility_view
from dawa_api.countries.ke.counties import KENYA_COUNTIES, county_by_code
from dawa_api.ingestion.county_repository import COUNTY_GENERATOR_VERSION, CountySnapshotRepository
from dawa_api.jobs.county_repository import CountyRunConflict, CountyRunRepository
from dawa_api.optimization.kisumu import rank_kisumu
from dawa_api.optimization.mitigation import RunMismatch
from dawa_api.optimization.modeled_schemas import ModeledRequest, ModeledResponse
from dawa_api.optimization.service import DuplicateCandidateID, TargetUnreachable
from dawa_api.scenarios.router import can_create, can_plan, current_principal, session_for_request
from dawa_api.scenarios.schemas import ScenarioCreate

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


class CountyRunCreate(ScenarioCreate):
    seed: int = Field(ge=-(2**63), le=2**63 - 1)
    horizon_days: int = Field(ge=1, le=365)


class CountyRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    country_code: str
    county_code: str
    seed: int
    horizon_days: int
    snapshot_version: int
    simulation_version: int
    status: str
    result: dict[str, Any] | None
    synthetic: bool = True


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


@router.get("/{county_code}/facilities/{facility_id}")
async def facility(
    county_code: str,
    facility_id: str,
    principal: Annotated[Principal, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    seed: Seed,
    version: Annotated[int, Query(ge=1)] = COUNTY_GENERATOR_VERSION,
) -> dict[str, Any]:
    _check_county(principal, county_code, planning=False)
    if county_code != "042":
        raise HTTPException(status_code=404, detail="Facility pilot is available only in Kisumu")
    if principal.role == "facility" and principal.facility_id != facility_id:
        raise HTTPException(status_code=403, detail="Insufficient facility scope")
    snapshot = await CountySnapshotRepository(
        session, country_code="KE", county_code=county_code
    ).get(seed=seed, kind="pilot", version=version)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Synthetic pilot snapshot not found")
    try:
        return facility_view(snapshot.data, facility_id=facility_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Synthetic facility not found") from exc


@router.post("/{county_code}/runs", response_model=CountyRunRead, status_code=202)
async def submit_county_run(
    county_code: str,
    data: CountyRunCreate,
    response: Response,
    principal: Annotated[Principal, Depends(can_create)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=128)],
) -> CountyRunRead:
    _check_county(principal, county_code, planning=False)
    if county_code != "042":
        raise HTTPException(status_code=404, detail="Facility pilot is available only in Kisumu")
    scenario = data.model_dump(exclude={"seed", "horizon_days"})
    try:
        run, created = await CountyRunRepository(
            session, country_code="KE", county_code=county_code
        ).create(key, seed=data.seed, horizon_days=data.horizon_days, scenario=scenario)
    except CountyRunConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    response.status_code = 202 if created else 200
    return CountyRunRead.model_validate(run)


@router.get("/{county_code}/runs/{run_id}", response_model=CountyRunRead)
async def read_county_run(
    county_code: str,
    run_id: UUID,
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> CountyRunRead:
    _check_county(principal, county_code, planning=False)
    run = await CountyRunRepository(session, country_code="KE", county_code=county_code).get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Synthetic county run not found")
    return CountyRunRead.model_validate(run)


@router.post("/{county_code}/runs/{run_id}/mitigations", response_model=ModeledResponse)
async def rank_county_run(
    county_code: str,
    run_id: UUID,
    data: ModeledRequest,
    principal: Annotated[Principal, Depends(can_create)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> ModeledResponse:
    _check_county(principal, county_code, planning=False)
    run = await CountyRunRepository(session, country_code="KE", county_code=county_code).get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Synthetic county run not found")
    if run.status != "succeeded" or run.result is None or run.simulation_version != 1:
        raise HTTPException(status_code=409, detail="Succeeded supported county run required")
    snapshot = await CountySnapshotRepository(
        session, country_code="KE", county_code=county_code
    ).get(seed=run.seed, kind="pilot", version=run.snapshot_version)
    if snapshot is None:
        raise HTTPException(status_code=409, detail="Pinned synthetic snapshot unavailable")
    try:
        result, effects = await asyncio.to_thread(
            rank_kisumu,
            ScenarioCreate.model_validate(run.scenario),
            snapshot.data,
            run.result,
            request=data,
            horizon_days=run.horizon_days,
        )
    except (DuplicateCandidateID, TargetUnreachable, RunMismatch) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503, detail="Optimizer could not prove an optimal result"
        ) from exc
    return ModeledResponse(
        run_id=run_id,
        selected_ids=result.selected_ids,
        selected_reasons={item: "included_in_optimal_set" for item in result.selected_ids},
        excluded_reasons=result.excluded_reasons,
        cut_line=len(result.selected_ids),
        total_cost=result.total_cost,
        remaining_budget=data.budget - result.total_cost,
        minimum_benefit=data.minimum_benefit,
        effects=effects,
    )
