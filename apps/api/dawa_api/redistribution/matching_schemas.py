"""Synthetic multi-facility redistribution contracts."""

from pydantic import BaseModel, ConfigDict, Field

from dawa_api.validation import ExplicitTrue, JsonInteger, JsonNumber


class SupplyInput(BaseModel):
    facility_id: str = Field(min_length=1, max_length=64)
    available: JsonInteger = Field(ge=0, le=1_000_000_000)
    shelf_life_days: JsonInteger = Field(ge=0, le=36500)


class DemandInput(BaseModel):
    facility_id: str = Field(min_length=1, max_length=64)
    needed: JsonInteger = Field(ge=0, le=1_000_000_000)


class LaneInput(BaseModel):
    source_id: str = Field(min_length=1, max_length=64)
    target_id: str = Field(min_length=1, max_length=64)
    distance_km: JsonNumber = Field(ge=0, le=10000, allow_inf_nan=False)


class MatchRequest(BaseModel):
    synthetic_attested: ExplicitTrue
    commodity_id: str = Field(pattern=r"^SYN-C(?:0[1-9]|10)$")
    sources: list[SupplyInput] = Field(max_length=20)
    targets: list[DemandInput] = Field(max_length=20)
    lanes: list[LaneInput] = Field(max_length=400)
    max_distance_km: JsonNumber = Field(ge=0, le=10000, allow_inf_nan=False)
    minimum_shelf_life_days: JsonInteger = Field(ge=0, le=36500)


class TransferRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    source_id: str
    target_id: str
    quantity: int
    distance_km: float


class MatchResponse(BaseModel):
    synthetic: bool = True
    notice: str = "Illustrative and unvalidated; no physical transfer has occurred"
    commodity_id: str
    transfers: list[TransferRead]
    total_quantity: int
