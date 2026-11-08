"""Rank interventions against the pinned synthetic Kisumu pilot."""

from dataclasses import replace
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
    """Use only planted routes and batches as modeled transfers."""
    if snapshot.get("county_code") != "042" or result.get("county_code") != "042":
        raise ValueError("Synthetic Kisumu inputs are required")
    cases = snapshot["demo_cases"]
    routes = cases.get("transfer_routes") or [cases["near_expiry_transfer"]]
    for candidate in request.candidates:
        if isinstance(candidate, ModeledTransfer) and not any(
            candidate.donor_facility_id == route["donor_facility_id"]
            and candidate.facility_id == route["facility_id"]
            and candidate.commodity_id == route["commodity_id"]
            and candidate.distance_km == route["distance_km"]
            and candidate.expiry_day == route["expiry_day"]
            and candidate.available_units <= route["available_units"]
            and candidate.quantity <= candidate.available_units
            for route in routes
        ):
            raise ValueError("Transfer does not match the pinned synthetic route and batch")
    ranked, effects = rank_deliveries(
        scenario,
        snapshot,
        result["stockouts"],
        horizon_days=horizon_days,
        request=request,
        simulation_version=5,
    )
    # Name the budget when an unselected action no longer fits what is left of it.
    remaining = request.budget - ranked.total_cost
    costs = {candidate.id: candidate.cost for candidate in request.candidates}
    reasons = {
        key: "remaining_budget_exceeded"
        if reason == "not_selected_by_optimal_set" and costs[key] > remaining
        else reason
        for key, reason in ranked.excluded_reasons.items()
    }
    return replace(ranked, excluded_reasons=reasons), effects
