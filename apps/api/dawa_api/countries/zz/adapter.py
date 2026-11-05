"""Explicitly non-operational placeholder for a future country adapter."""

from dawa_api.countries.base import CountryConfig


class PlaceholderAdapter:
    def __init__(self, config: CountryConfig) -> None:
        self.config = config

    @property
    def configured(self) -> bool:
        return False

    def supports_synthetic_facility(self, facility_id: str) -> bool:
        return False
