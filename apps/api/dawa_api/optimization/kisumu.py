"""Rank interventions against the pinned synthetic Kisumu pilot."""

from typing import Any

from dawa_api.optimization.mitigation import rank_deliveries
from dawa_api.optimization.modeled_schemas import ModeledEffect, ModeledRequest, ModeledTransfer
from dawa_api.optimization.service import OptimizationResult
from dawa_api.scenarios.schemas import ScenarioCreate


def rank_kisumu(
    scenario: ScenarioCreate,
    snapshot: dict[str, Any],
    result: dict[str, Any],
    *,
    request: ModeledRequest,
    horizon_days: int,
) -> tuple[OptimizationResult, list[ModeledEffect]]:
    """Use the planted route and batch as the only available modeled transfer."""
    if snapshot.get("county_code") != "042" or result.get("county_code") != "042":
        raise ValueError("Synthetic Kisumu inputs are required")
    route = snapshot["demo_cases"]["near_expiry_transfer"]
    for candidate in request.candidates:
        if isinstance(candidate, ModeledTransfer):
            if (
                candidate.donor_facility_id != route["donor_facility_id"]
                or candidate.facility_id != route["facility_id"]
                or candidate.commodity_id != route["commodity_id"]
                or candidate.distance_km != route["distance_km"]
                or candidate.expiry_day != route["expiry_day"]
                or candidate.available_units > route["available_units"]
                or candidate.quantity > candidate.available_units
            ):
                raise ValueError("Transfer does not match the pinned synthetic route and batch")
    return rank_deliveries(
        scenario,
        snapshot,
        result["stockouts"],
        horizon_days=horizon_days,
        request=request,
        simulation_version=5,
    )
