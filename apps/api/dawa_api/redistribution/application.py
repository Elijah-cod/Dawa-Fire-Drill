"""Validate and match a synthetic one-commodity redistribution request."""

from dawa_api.countries.service import is_synthetic_facility
from dawa_api.redistribution.matching import Demand, Lane, MatchResult, Supply, match_transfers
from dawa_api.redistribution.matching_schemas import MatchRequest


def match_synthetic(data: MatchRequest, *, country_code: str) -> MatchResult:
    facility_ids = [item.facility_id for item in data.sources] + [
        item.facility_id for item in data.targets
    ]
    if not all(is_synthetic_facility(country_code, item) for item in facility_ids):
        raise ValueError("Only synthetic demo facilities are supported")
    return match_transfers(
        sources=[Supply(**item.model_dump()) for item in data.sources],
        targets=[Demand(**item.model_dump()) for item in data.targets],
        lanes=[Lane(**item.model_dump()) for item in data.lanes],
        max_distance_km=data.max_distance_km,
        minimum_shelf_life_days=data.minimum_shelf_life_days,
    )
