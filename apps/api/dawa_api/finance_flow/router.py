"""Authenticated synthetic funding-stage diagnostics."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.auth.service import Principal
from dawa_api.finance_flow.application import trace_request
from dawa_api.finance_flow.repository import FundingConflict, FundingRepository
from dawa_api.finance_flow.schemas import (
    FundingPage,
    FundingRead,
    FundingTraceRequest,
    FundingTraceResponse,
)
from dawa_api.scenarios.router import can_create, can_plan, session_for_request

router = APIRouter(prefix="/funding", tags=["funding"])


@router.post("/trace", response_model=FundingTraceResponse)
async def trace(
    data: FundingTraceRequest, principal: Annotated[Principal, Depends(can_plan)]
) -> FundingTraceResponse:
    _ = principal
    try:
        return trace_request(data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/flows", response_model=FundingRead, status_code=status.HTTP_201_CREATED)
async def create_flow(
    data: FundingTraceRequest,
    response: Response,
    principal: Annotated[Principal, Depends(can_create)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=128)],
) -> FundingRead:
    try:
        flow, created = await FundingRepository(
            session, country_code=principal.country_code
        ).create(key, data)
    except FundingConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    response.status_code = 201 if created else 200
    return FundingRead.model_validate(flow)


@router.get("/flows", response_model=FundingPage)
async def list_flows(
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FundingPage:
    flows = await FundingRepository(session, country_code=principal.country_code).list_page(
        limit=limit, offset=offset
    )
    return FundingPage(
        items=[FundingRead.model_validate(flow) for flow in flows], limit=limit, offset=offset
    )


@router.get("/flows/{flow_id}/trace", response_model=FundingTraceResponse)
async def get_trace(
    flow_id: UUID,
    as_of: date,
    principal: Annotated[Principal, Depends(can_plan)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> FundingTraceResponse:
    flow = await FundingRepository(session, country_code=principal.country_code).get(flow_id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Funding flow not found")
    try:
        data = FundingTraceRequest.model_validate(
            flow.payload | {"synthetic_attested": True, "as_of": as_of}
        )
        return trace_request(data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
