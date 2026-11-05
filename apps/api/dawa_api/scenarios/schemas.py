"""Synthetic scenario request and response contracts."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    shock_type: Literal["logistics_reduction", "cash_delay"]
    magnitude: int = Field(ge=0, le=3650)

    @model_validator(mode="after")
    def validate_magnitude(self) -> "ScenarioCreate":
        if self.shock_type == "logistics_reduction" and self.magnitude > 100:
            raise ValueError("Logistics reduction cannot exceed 100 percent")
        return self


class ScenarioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    country_code: str
    payload: dict[str, object]
    created_at: datetime
    synthetic: bool = True


class ScenarioPage(BaseModel):
    items: list[ScenarioRead]
    limit: int
    offset: int
