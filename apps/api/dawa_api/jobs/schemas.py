"""Run submission and status contracts."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RunCreate(BaseModel):
    seed: int = Field(default=42, ge=-(2**63), lt=2**63)
    horizon_days: int = Field(default=90, ge=1, le=365)


class RunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    scenario_id: UUID
    country_code: str
    seed: int
    generator_version: int
    horizon_days: int
    status: Literal["queued", "running", "succeeded", "failed"]
    result: dict[str, Any] | None
    error: str | None
    created_at: datetime
    synthetic: bool = True
    notice: str = "Illustrative and unvalidated"


class RunPage(BaseModel):
    items: list[RunRead]
    limit: int
    offset: int


class RunComparison(BaseModel):
    synthetic: bool = True
    notice: str = "Illustrative and unvalidated; compare runs only under their stated assumptions"
    left: RunRead
    right: RunRead
