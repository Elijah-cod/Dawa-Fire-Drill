"""Authenticated synthetic baseline forecast endpoint."""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator

from dawa_api.auth.service import Principal
from dawa_api.forecasting.service import forecast
from dawa_api.scenarios.router import can_plan

router = APIRouter(tags=["forecasting"])


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    synthetic_attested: Literal[True]
    history: list[Annotated[int, Field(ge=0, le=1_000_000_000)]] = Field(
        min_length=1, max_length=120
    )
    lead_time_periods: int = Field(ge=0, le=120)
    safety_periods: int = Field(ge=0, le=120)

    @field_validator("synthetic_attested", mode="before")
    @classmethod
    def explicit_attestation(cls, value: Any) -> Any:
        if value is not True:
            raise ValueError("Synthetic attestation must be true")
        return value

    @field_validator("lead_time_periods", "safety_periods", mode="before")
    @classmethod
    def numeric_period(cls, value: Any) -> Any:
        if type(value) not in (int, float):
            raise ValueError("Period must be a JSON number")
        return value

    @field_validator("history", mode="before")
    @classmethod
    def numeric_history(cls, value: Any) -> Any:
        if isinstance(value, list) and any(type(item) not in (int, float) for item in value):
            raise ValueError("History values must be JSON numbers")
        return value


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
