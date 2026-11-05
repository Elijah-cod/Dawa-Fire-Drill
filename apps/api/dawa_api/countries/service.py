"""Load allowed country adapters without accepting arbitrary paths."""

import json
from importlib.resources import files

from dawa_api.countries.base import CountryAdapter, CountryConfig
from dawa_api.countries.ke.adapter import KenyaAdapter
from dawa_api.countries.zz.adapter import PlaceholderAdapter


class CountryNotConfigured(ValueError):
    """A country is unknown or still a placeholder."""


def get_adapter(code: str) -> CountryAdapter:
    normalized = code.upper()
    if normalized not in {"KE", "ZZ"}:
        raise CountryNotConfigured(f"Country {normalized} is not configured")
    resource = files(f"dawa_api.countries.{normalized.lower()}").joinpath("config.yaml")
    raw = json.loads(resource.read_text(encoding="utf-8"))
    config = CountryConfig(code=raw["code"], currency=raw["currency"], configured=raw["configured"])
    return KenyaAdapter(config) if normalized == "KE" else PlaceholderAdapter(config)


def get_country(code: str) -> CountryConfig:
    adapter = get_adapter(code)
    if not adapter.configured:
        raise CountryNotConfigured(f"Country {code.upper()} is a placeholder")
    return adapter.config


def is_synthetic_facility(country_code: str, facility_id: str) -> bool:
    return get_adapter(country_code).supports_synthetic_facility(facility_id)
