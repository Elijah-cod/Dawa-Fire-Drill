"""Authenticated optimizer endpoint for synthetic candidate inputs."""

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dawa_api.auth.service import Principal
from dawa_api.optimization.service import Candidate, select_actions
from dawa_api.scenarios.router import can_create

router = APIRouter(prefix="/optimization", tags=["optimization"])


class CandidateInput(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    cost: int = Field(ge=0, le=1_000_000_000)
    benefit: int = Field(ge=0, le=1_000_000)


class RankRequest(BaseModel):
    budget: int = Field(ge=0, le=1_000_000_000)
    candidates: list[CandidateInput] = Field(max_length=50)


class RankResponse(BaseModel):
    synthetic: bool = True
    notice: str = "Illustrative and unvalidated; benefits are supplied assumptions"
    selected_ids: tuple[str, ...]
    selected_reasons: dict[str, str]
    excluded_reasons: dict[str, str]
    total_cost: int
    remaining_budget: int
    cut_line: int


@router.post("/rank", response_model=RankResponse)
async def rank(
    data: RankRequest, principal: Annotated[Principal, Depends(can_create)]
) -> RankResponse:
    _ = principal
    try:
        result = await asyncio.to_thread(
            select_actions,
            [Candidate(item.id, item.cost, item.benefit) for item in data.candidates],
            budget=data.budget,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return RankResponse(
        selected_ids=result.selected_ids,
        selected_reasons={item: "included_in_optimal_set" for item in result.selected_ids},
        excluded_reasons=result.excluded_reasons,
        total_cost=result.total_cost,
        remaining_budget=data.budget - result.total_cost,
        cut_line=len(result.selected_ids),
    )
