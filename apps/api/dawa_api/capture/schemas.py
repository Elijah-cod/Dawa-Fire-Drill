"""Synthetic capture review contracts."""

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from dawa_api.capture.extraction import BinCardFields


class CaptureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    country_code: str
    facility_id: str
    fields: dict[str, Any]
    provider_status: str
    status: Literal["pending", "confirmed"]
    created_at: datetime
    synthetic: bool = True
    notice: str = "Synthetic data; extraction requires human review"


class CaptureConfirmation(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    reviewed: Literal[True]
    fields: BinCardFields


class CapturePage(BaseModel):
    items: list[CaptureRead]
    limit: int
    offset: int


class StockEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    capture_id: UUID
    country_code: str
    facility_id: str
    commodity_name: str
    opening_balance: int
    closing_balance: int
    record_date: date
    created_at: datetime
    synthetic: bool = True
