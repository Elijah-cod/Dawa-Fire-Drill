"""Authenticated scenario-run submission and retrieval."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.auth.service import Principal
from dawa_api.jobs.repository import RunConflict, RunRepository
from dawa_api.jobs.schemas import RunComparison, RunCreate, RunPage, RunRead
from dawa_api.scenarios.router import can_create, can_plan, current_principal, session_for_request

router = APIRouter(tags=["runs"])


@router.post(
    "/scenarios/{scenario_id}/runs", response_model=RunRead, status_code=status.HTTP_202_ACCEPTED
)
async def submit_run(
    scenario_id: UUID,
    data: RunCreate,
    response: Response,
    principal: Annotated[Principal, Depends(can_create)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=128)],
) -> RunRead:
    try:
        run, created = await RunRepository(session, country_code=principal.country_code).create(
            scenario_id, key, seed=data.seed, horizon_days=data.horizon_days
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Scenario not found") from exc
    except RunConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    response.status_code = 202 if created else 200
    return RunRead.model_validate(run)


@router.get("/runs/compare", response_model=RunComparison)
async def compare_runs(
    left: UUID,
    right: UUID,
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> RunComparison:
    if left == right:
        raise HTTPException(status_code=422, detail="Choose two different runs")
    repository = RunRepository(session, country_code=principal.country_code)
    first, second = await repository.get(left), await repository.get(right)
    if first is None or second is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if first.status != "succeeded" or second.status != "succeeded":
        raise HTTPException(status_code=409, detail="Both runs must have succeeded")
    return RunComparison(left=RunRead.model_validate(first), right=RunRead.model_validate(second))


@router.get("/runs/{run_id}", response_model=RunRead)
async def get_run(
    run_id: UUID,
    principal: Annotated[Principal, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> RunRead:
    run = await RunRepository(session, country_code=principal.country_code).get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return RunRead.model_validate(run)


@router.get("/scenarios/{scenario_id}/runs", response_model=RunPage)
async def list_runs(
    scenario_id: UUID,
    principal: Annotated[Principal, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RunPage:
    runs = await RunRepository(session, country_code=principal.country_code).list_page(
        scenario_id=scenario_id, limit=limit, offset=offset
    )
    return RunPage(items=[RunRead.model_validate(run) for run in runs], limit=limit, offset=offset)
