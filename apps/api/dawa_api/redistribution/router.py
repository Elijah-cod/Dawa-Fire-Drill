"""Authenticated synthetic redistribution feasibility endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dawa_api.auth.service import Principal
from dawa_api.countries.service import is_synthetic_facility
from dawa_api.redistribution.service import FacilityStock, suggest_transfer
from dawa_api.scenarios.router import can_plan
from dawa_api.validation import ExplicitTrue

router = APIRouter(prefix="/redistribution", tags=["redistribution"])


class TransferRequest(BaseModel):
    synthetic_attested: ExplicitTrue
    source_id: str = Field(min_length=1, max_length=64)
    target_id: str = Field(min_length=1, max_length=64)
    available: int = Field(ge=0, le=1_000_000_000)
    needed: int = Field(ge=0, le=1_000_000_000)
    shelf_life_days: int = Field(ge=0, le=36500)
    minimum_shelf_life_days: int = Field(ge=0, le=36500)
    distance_km: float = Field(ge=0, le=10000, allow_inf_nan=False)
    max_distance_km: float = Field(ge=0, le=10000, allow_inf_nan=False)


class TransferResponse(BaseModel):
    synthetic: bool = True
    notice: str = "Illustrative and unvalidated; no physical transfer has occurred"
    quantity: int
    reasons: tuple[str, ...]


@router.post("/suggest", response_model=TransferResponse)
async def suggest(
    data: TransferRequest, principal: Annotated[Principal, Depends(can_plan)]
) -> TransferResponse:
    if not all(
        is_synthetic_facility(principal.country_code, item)
        for item in (data.source_id, data.target_id)
    ):
        raise HTTPException(status_code=422, detail="Only synthetic demo facilities are supported")
    try:
        result = suggest_transfer(
            FacilityStock(data.source_id, data.available, data.shelf_life_days),
            FacilityStock(data.target_id, 0, 0),
            needed=data.needed,
            distance_km=data.distance_km,
            max_distance_km=data.max_distance_km,
            minimum_shelf_life_days=data.minimum_shelf_life_days,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return TransferResponse(quantity=result.quantity, reasons=result.reasons)
