"""Contracts for synthetic intervention replay."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from dawa_api.validation import BenefitTarget, ExplicitTrue, JsonInteger


class CandidateBase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    facility_id: str = Field(min_length=1, max_length=120)
    commodity_id: str = Field(min_length=1, max_length=120)
    cost: JsonInteger = Field(ge=0, le=1_000_000_000)
    arrival_day: JsonInteger = Field(ge=1, le=365)


class ModeledDelivery(CandidateBase):
    kind: Literal["emergency_procurement"] = "emergency_procurement"
    quantity: JsonInteger = Field(ge=1, le=1_000_000_000)


class ModeledReorder(CandidateBase):
    kind: Literal["reorder_timing"]
    original_day: JsonInteger = Field(ge=1, le=365)


class ModeledTransfer(CandidateBase):
    kind: Literal["redistribution"]
    donor_facility_id: str = Field(min_length=1, max_length=120)
    dispatch_day: JsonInteger = Field(ge=1, le=365)
    quantity: JsonInteger = Field(ge=1, le=1_000_000_000)
    available_units: JsonInteger = Field(ge=0, le=1_000_000_000)
    expiry_day: JsonInteger = Field(ge=1, le=10_000)
    minimum_shelf_days: JsonInteger = Field(ge=0, le=365)
    distance_km: JsonInteger = Field(ge=0, le=100_000)
    max_distance_km: JsonInteger = Field(ge=0, le=100_000)


class ModeledRequest(BaseModel):
    synthetic_attested: ExplicitTrue
    budget: JsonInteger = Field(ge=0, le=1_000_000_000)
    minimum_benefit: BenefitTarget | None = None
    candidates: list[ModeledDelivery | ModeledReorder | ModeledTransfer] = Field(max_length=50)


class ModeledEffect(BaseModel):
    id: str
    baseline_stockout_day: int
    counterfactual_stockout_day: int | None
    deferred_days: int


class ModeledResponse(BaseModel):
    synthetic: bool = True
    notice: str = (
        "Illustrative and unvalidated; delivery timing, quantity and cost "
        "are supplied assumptions. "
        "Days deferred measure the model's first stockout within its horizon."
    )
    run_id: UUID
    explanation: str | None = None
    selected_ids: tuple[str, ...]
    selected_reasons: dict[str, str]
    excluded_reasons: dict[str, str]
    cut_line: int
    total_cost: int
    remaining_budget: int
    minimum_benefit: int | None
    effects: list[ModeledEffect]
