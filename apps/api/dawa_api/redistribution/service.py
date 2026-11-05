"""Apply stock, distance, and remaining shelf-life constraints."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FacilityStock:
    facility_id: str
    available: int
    shelf_life_days: int


@dataclass(frozen=True)
class TransferSuggestion:
    quantity: int
    reasons: tuple[str, ...]


def suggest_transfer(
    source: FacilityStock,
    target: FacilityStock,
    *,
    needed: int,
    distance_km: float,
    max_distance_km: float,
    minimum_shelf_life_days: int,
) -> TransferSuggestion:
    if (
        min(
            source.available,
            target.available,
            source.shelf_life_days,
            needed,
            distance_km,
            max_distance_km,
            minimum_shelf_life_days,
        )
        < 0
    ):
        raise ValueError("Stock, need, distance, and shelf life must be nonnegative")
    if source.facility_id == target.facility_id:
        raise ValueError("Source and target must differ")
    reasons = []
    if distance_km > max_distance_km:
        reasons.append("distance_exceeded")
    if source.shelf_life_days < minimum_shelf_life_days:
        reasons.append("shelf_life_too_short")
    return TransferSuggestion(0 if reasons else min(source.available, needed), tuple(reasons))
