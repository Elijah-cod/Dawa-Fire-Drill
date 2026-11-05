"""Read-only contracts for versioned synthetic catalog entries."""

from pydantic import BaseModel


class FacilityRead(BaseModel):
    id: str
    country_code: str
    county: str
    level: int
    lead_time_days: int


class CommodityRead(BaseModel):
    id: str
    name: str


class CatalogPage[T](BaseModel):
    synthetic: bool = True
    notice: str = "Synthetic demo data; non-facility quantities are illustrative assumptions"
    country_code: str
    seed: int
    generator_version: int
    items: list[T]
    total: int
    limit: int
    offset: int
