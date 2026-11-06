"""Authenticated optimizer endpoint for synthetic candidate inputs."""

import asyncio
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, StrictBool
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.auth.service import Principal
from dawa_api.capture.repository import PostgresExtractionStore
from dawa_api.explain.service import explain_selection, explain_with_providers
from dawa_api.ingestion.repository import DatasetRepository
from dawa_api.jobs.repository import RunRepository
from dawa_api.optimization.mitigation import RunMismatch, rank_deliveries
from dawa_api.optimization.modeled_schemas import ModeledRequest, ModeledResponse
from dawa_api.optimization.service import (
    Candidate,
    DuplicateCandidateID,
    TargetUnreachable,
    select_actions,
)
from dawa_api.scenarios.router import can_create, session_for_request
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.storage.scenarios import ScenarioRepository
from dawa_api.validation import BenefitTarget, ExplicitTrue, JsonInteger

router = APIRouter(prefix="/optimization", tags=["optimization"])
run_router = APIRouter(tags=["optimization"])


class CandidateInput(BaseModel):
    id: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    cost: JsonInteger = Field(ge=0, le=1_000_000_000)
    benefit: JsonInteger = Field(ge=0, le=1_000_000)


class RankRequest(BaseModel):
    synthetic_attested: ExplicitTrue
    budget: JsonInteger = Field(ge=0, le=1_000_000_000)
    minimum_benefit: BenefitTarget | None = None
    candidates: list[CandidateInput] = Field(max_length=50)
    include_llm_explanation: StrictBool = False


class RankResponse(BaseModel):
    synthetic: bool = True
    notice: str = "Illustrative and unvalidated; benefits are supplied assumptions"
    minimum_benefit: int | None = None
    selected_ids: tuple[str, ...]
    selected_reasons: dict[str, str]
    excluded_reasons: dict[str, str]
    total_cost: int
    remaining_budget: int
    cut_line: int
    explanation: str


class RunCandidate(CandidateInput):
    kind: Literal["emergency_procurement", "redistribution", "reorder_timing"]
    facility_id: str = Field(min_length=1, max_length=120)
    commodity_id: str = Field(min_length=1, max_length=120)


class RunRankRequest(BaseModel):
    synthetic_attested: ExplicitTrue
    budget: JsonInteger = Field(ge=0, le=1_000_000_000)
    minimum_benefit: BenefitTarget | None = None
    candidates: list[RunCandidate] = Field(max_length=50)
    include_llm_explanation: StrictBool = False


class RunRankResponse(RankResponse):
    run_id: UUID
    candidates: list[RunCandidate]


@run_router.post(
    "/runs/{run_id}/modeled-mitigations",
    response_model=ModeledResponse,
    responses={
        409: {"description": "Run or benefit target is unavailable"},
        503: {"description": "Optimizer could not prove an optimal result"},
    },
)
async def rank_modeled_deliveries(
    run_id: UUID,
    data: ModeledRequest,
    principal: Annotated[Principal, Depends(can_create)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> ModeledResponse:
    run = await RunRepository(session, country_code=principal.country_code).get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "succeeded" or run.result is None or run.simulation_version not in (1, 2):
        raise HTTPException(status_code=409, detail="Succeeded supported run required")
    snapshot = await DatasetRepository(session, country_code=principal.country_code).get(
        seed=run.seed, version=run.generator_version
    )
    scenario = await ScenarioRepository(session, country_code=principal.country_code).get(
        run.scenario_id
    )
    if snapshot is None or scenario is None:
        raise HTTPException(status_code=409, detail="Pinned run inputs are unavailable")
    try:
        result, effects = await asyncio.to_thread(
            rank_deliveries,
            ScenarioCreate.model_validate(scenario.payload),
            snapshot.data,
            run.result["stockouts"],
            horizon_days=run.horizon_days,
            request=data,
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
        excluded_reasons=result.excluded_reasons,
        total_cost=result.total_cost,
        remaining_budget=data.budget - result.total_cost,
        minimum_benefit=data.minimum_benefit,
        effects=effects,
    )


@run_router.post(
    "/runs/{run_id}/mitigations",
    response_model=RunRankResponse,
    responses={503: {"description": "Optimizer could not prove an optimal result"}},
)
async def rank_run(
    run_id: UUID,
    data: RunRankRequest,
    request: Request,
    principal: Annotated[Principal, Depends(can_create)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> RunRankResponse:
    run = await RunRepository(session, country_code=principal.country_code).get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "succeeded" or run.result is None:
        raise HTTPException(status_code=409, detail="Run has not succeeded")
    stockouts = {(item["facility_id"], item["commodity_id"]) for item in run.result["stockouts"]}
    if any((item.facility_id, item.commodity_id) not in stockouts for item in data.candidates):
        raise HTTPException(status_code=422, detail="Candidate must target a recorded stockout")
    result = await rank(
        RankRequest(
            synthetic_attested=True,
            budget=data.budget,
            minimum_benefit=data.minimum_benefit,
            candidates=data.candidates,
            include_llm_explanation=data.include_llm_explanation,
        ),
        request,
        principal,
    )
    return RunRankResponse(**result.model_dump(), run_id=run_id, candidates=data.candidates)


@router.post(
    "/rank",
    response_model=RankResponse,
    responses={
        409: {"description": "Candidate identifiers conflict or benefit target is unreachable"},
        503: {"description": "Optimizer could not prove an optimal result"},
    },
)
async def rank(
    data: RankRequest, request: Request, principal: Annotated[Principal, Depends(can_create)]
) -> RankResponse:
    _ = principal
    try:
        result = await asyncio.to_thread(
            select_actions,
            [
                Candidate(
                    item.id,
                    item.cost,
                    item.benefit,
                    group=(item.facility_id, item.commodity_id)
                    if isinstance(item, RunCandidate)
                    else None,
                )
                for item in data.candidates
            ],
            budget=data.budget,
            minimum_benefit=data.minimum_benefit,
        )
    except (DuplicateCandidateID, TargetUnreachable) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503, detail="Optimizer could not prove an optimal result"
        ) from exc
    explanation = explain_selection(result, budget=data.budget)
    if data.include_llm_explanation:
        store = PostgresExtractionStore(
            request.app.state.sessions, daily_cap=request.app.state.settings.llm_daily_call_cap
        )
        explanation = await explain_with_providers(
            result,
            budget=data.budget,
            providers=request.app.state.explanation_providers,
            store=store,
        )
    return RankResponse(
        minimum_benefit=data.minimum_benefit,
        selected_ids=result.selected_ids,
        selected_reasons={item: "included_in_optimal_set" for item in result.selected_ids},
        excluded_reasons=result.excluded_reasons,
        total_cost=result.total_cost,
        remaining_budget=data.budget - result.total_cost,
        cut_line=len(result.selected_ids),
        explanation=explanation.text,
    )
