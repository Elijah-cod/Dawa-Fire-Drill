"""Authenticated synthetic baseline forecast endpoint."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator

from dawa_api.auth.service import Principal
from dawa_api.forecasting.service import forecast
from dawa_api.scenarios.router import can_plan
from dawa_api.validation import ExplicitTrue, require_json_number

router = APIRouter(tags=["forecasting"])


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    synthetic_attested: ExplicitTrue
    history: list[Annotated[int, Field(ge=0, le=1_000_000_000)]] = Field(
        min_length=1, max_length=120
    )
    lead_time_periods: int = Field(ge=0, le=120)
    safety_periods: int = Field(ge=0, le=120)
    stock_on_hand: int | None = Field(default=None, ge=0, le=1_000_000_000)

    @field_validator("stock_on_hand", mode="before")
    @classmethod
    def numeric_stock(cls, value: Any) -> Any:
        return None if value is None else require_json_number(value)

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
    notice: str = "Illustrative and unvalidated; constant demand and no incoming stock assumed"
    average_demand: float
    reorder_point: float
    stockout_period: int | None


@router.post("/forecast", response_model=ForecastResponse)
async def forecast_demand(
    data: ForecastRequest, principal: Annotated[Principal, Depends(can_plan)]
) -> ForecastResponse:
    _ = principal
    result = forecast(
        data.history,
        lead_time_periods=data.lead_time_periods,
        safety_periods=data.safety_periods,
        stock_on_hand=data.stock_on_hand,
    )
    return ForecastResponse(
        average_demand=result.average_demand,
        reorder_point=result.reorder_point,
        stockout_period=result.stockout_period,
    )
