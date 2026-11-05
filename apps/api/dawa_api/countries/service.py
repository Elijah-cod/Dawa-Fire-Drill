"""Load the allowed country adapters without accepting arbitrary paths."""

import json
import re
from dataclasses import dataclass
from importlib.resources import files


class CountryNotConfigured(ValueError):
    """A country is unknown or still a placeholder."""


@dataclass(frozen=True)
class CountryConfig:
    code: str
    currency: str


def get_country(code: str) -> CountryConfig:
    normalized = code.upper()
    if normalized not in {"KE", "ZZ"}:
        raise CountryNotConfigured(f"Country {normalized} is not configured")
    resource = files(f"dawa_api.countries.{normalized.lower()}").joinpath("config.yaml")
    config = json.loads(resource.read_text(encoding="utf-8"))
    if not config["configured"]:
        raise CountryNotConfigured(f"Country {normalized} is a placeholder")
    return CountryConfig(code=config["code"], currency=config["currency"])


def is_synthetic_facility(country_code: str, facility_id: str) -> bool:
    return bool(
        re.fullmatch(rf"SYN-{re.escape(country_code)}-F(?:00[1-9]|0[1-3][0-9]|040)", facility_id)
    )
