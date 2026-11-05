"""Authenticated synthetic baseline forecast endpoint."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from dawa_api.auth.service import Principal
from dawa_api.forecasting.service import forecast
from dawa_api.scenarios.router import can_plan

router = APIRouter(tags=["forecasting"])


class ForecastRequest(BaseModel):
    synthetic_attested: Literal[True]
    history: list[Annotated[int, Field(ge=0, le=1_000_000_000)]] = Field(
        min_length=1, max_length=120
    )
    lead_time_periods: int = Field(ge=0, le=120)
    safety_periods: int = Field(ge=0, le=120)


class ForecastResponse(BaseModel):
    synthetic: bool = True
    notice: str = "Illustrative and unvalidated"
    average_demand: float
    reorder_point: float


@router.post("/forecast", response_model=ForecastResponse)
async def forecast_demand(
    data: ForecastRequest, principal: Annotated[Principal, Depends(can_plan)]
) -> ForecastResponse:
    _ = principal
    result = forecast(
        data.history, lead_time_periods=data.lead_time_periods, safety_periods=data.safety_periods
    )
    return ForecastResponse(
        average_demand=result.average_demand, reorder_point=result.reorder_point
    )
