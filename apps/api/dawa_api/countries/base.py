"""Country configuration and adapter contract."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class CountryConfig:
    code: str
    currency: str
    configured: bool


class CountryAdapter(Protocol):
    config: CountryConfig

    @property
    def configured(self) -> bool: ...

    def supports_synthetic_facility(self, facility_id: str) -> bool: ...
