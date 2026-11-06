"""Synthetic funding trace request and response contracts."""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from dawa_api.validation import ExplicitTrue


class FundingTraceRequest(BaseModel):
    synthetic_attested: ExplicitTrue
    approved: int = Field(ge=0, le=1_000_000_000)
    released: int = Field(ge=0, le=1_000_000_000)
    procured: int = Field(ge=0, le=1_000_000_000)
    delivered: int = Field(ge=0, le=1_000_000_000)
    approved_on: date
    released_on: date | None
    procured_on: date | None
    delivered_on: date | None
    as_of: date


class BottleneckRead(BaseModel):
    stage: str
    amount: int
    age_days: int


class FundingTraceResponse(BaseModel):
    synthetic: bool = True
    notice: str = "Illustrative and unvalidated"
    currency: str | None = None
    bottlenecks: list[BottleneckRead]


class FundingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    country_code: str
    payload: dict[str, Any]
    created_at: datetime
    synthetic: bool = True


class FundingPage(BaseModel):
    items: list[FundingRead]
    limit: int
    offset: int
