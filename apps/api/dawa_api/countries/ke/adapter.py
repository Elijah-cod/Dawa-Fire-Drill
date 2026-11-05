"""Kenya synthetic demonstration adapter."""

import re

from dawa_api.countries.base import CountryConfig


class KenyaAdapter:
    def __init__(self, config: CountryConfig) -> None:
        self.config = config

    @property
    def configured(self) -> bool:
        return self.config.configured

    def supports_synthetic_facility(self, facility_id: str) -> bool:
        return self.configured and bool(
            re.fullmatch(r"SYN-KE-F(?:00[1-9]|0[1-3][0-9]|040)", facility_id)
        )
