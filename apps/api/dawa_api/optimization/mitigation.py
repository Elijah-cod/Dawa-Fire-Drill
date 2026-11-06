"""Replay assumed synthetic interventions through the pinned stock-flow model."""

from dataclasses import dataclass
from typing import Any

from dawa_api.optimization.modeled_schemas import ModeledDelivery, ModeledEffect, ModeledRequest
from dawa_api.optimization.service import Candidate, OptimizationResult, select_actions
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.scenario import stock_parameters
from dawa_api.simulation.service import simulate_stock


@dataclass(frozen=True)
class DeliveryEffect:
    baseline_stockout_day: int | None
    counterfactual_stockout_day: int | None
    deferred_days: int


class RunMismatch(ValueError):
    """Replayed inputs do not reproduce the stored run."""


def _stock_inputs(
    scenario: ScenarioCreate,
    data: dict[str, Any],
    *,
    horizon_days: int,
    facility_id: str,
    commodity_id: str,
) -> tuple[int, dict[int, int]]:
    if data.get("synthetic") is not True or data.get("country_code") != "KE":
        raise ValueError("A synthetic Kenya snapshot is required")
    if facility_id not in {item["id"] for item in data["facilities"]}:
        raise ValueError("Unknown synthetic facility")
    history = [
        item
        for item in data["consumption"]
        if item["facility_id"] == facility_id
        and item["commodity_id"] == commodity_id
        and item["month_index"] == 23
    ]
    if len(history) != 1:
        raise ValueError("Synthetic facility and commodity history is unavailable")
    return stock_parameters(
        scenario, monthly_demand=history[0]["quantity"], horizon_days=horizon_days
    )


def _compare(
    demand: int, deliveries: dict[int, int], changed: dict[int, int], horizon_days: int
) -> DeliveryEffect:
    baseline = simulate_stock(
        opening_stock=demand * 30, daily_demand=demand, days=horizon_days, deliveries=deliveries
    ).stockout_day
    counterfactual = simulate_stock(
        opening_stock=demand * 30, daily_demand=demand, days=horizon_days, deliveries=changed
    ).stockout_day
    delta = (counterfactual or horizon_days + 1) - (baseline or horizon_days + 1)
    return DeliveryEffect(baseline, counterfactual, delta)


def evaluate_delivery(
    scenario: ScenarioCreate,
    data: dict[str, Any],
    *,
    horizon_days: int,
    facility_id: str,
    commodity_id: str,
    arrival_day: int,
    quantity: int,
) -> DeliveryEffect:
    """Compare first stockout dates, treating no stockout as horizon plus one."""
    if not 1 <= arrival_day <= horizon_days or not 1 <= quantity <= 1_000_000_000:
        raise ValueError("Delivery timing or quantity is outside supported bounds")
    demand, deliveries = _stock_inputs(
        scenario,
        data,
        horizon_days=horizon_days,
        facility_id=facility_id,
        commodity_id=commodity_id,
    )
    changed = deliveries.copy()
    changed[arrival_day] = changed.get(arrival_day, 0) + quantity
    return _compare(demand, deliveries, changed, horizon_days)


def evaluate_reorder(
    scenario: ScenarioCreate,
    data: dict[str, Any],
    *,
    horizon_days: int,
    facility_id: str,
    commodity_id: str,
    original_day: int,
    arrival_day: int,
) -> DeliveryEffect:
    """Move an existing modeled replenishment earlier without adding units."""
    demand, deliveries = _stock_inputs(
        scenario,
        data,
        horizon_days=horizon_days,
        facility_id=facility_id,
        commodity_id=commodity_id,
    )
    if original_day not in deliveries or not 1 <= arrival_day < original_day:
        raise ValueError("Reorder must advance an existing in-horizon delivery")
    changed = deliveries.copy()
    quantity = changed.pop(original_day)
    changed[arrival_day] = changed.get(arrival_day, 0) + quantity
    return _compare(demand, deliveries, changed, horizon_days)


def rank_deliveries(
    scenario: ScenarioCreate,
    snapshot: dict[str, Any],
    recorded: list[dict[str, Any]],
    *,
    horizon_days: int,
    request: ModeledRequest,
) -> tuple[OptimizationResult, list[ModeledEffect]]:
    stockouts = {(item["facility_id"], item["commodity_id"]): item["day"] for item in recorded}
    effects: list[ModeledEffect] = []
    candidates: list[Candidate] = []
    for item in request.candidates:
        key = (item.facility_id, item.commodity_id)
        if key not in stockouts:
            raise ValueError("Candidate must target a recorded stockout")
        if isinstance(item, ModeledDelivery):
            effect = evaluate_delivery(
                scenario,
                snapshot,
                horizon_days=horizon_days,
                facility_id=item.facility_id,
                commodity_id=item.commodity_id,
                arrival_day=item.arrival_day,
                quantity=item.quantity,
            )
        else:
            effect = evaluate_reorder(
                scenario,
                snapshot,
                horizon_days=horizon_days,
                facility_id=item.facility_id,
                commodity_id=item.commodity_id,
                arrival_day=item.arrival_day,
                original_day=item.original_day,
            )
        if effect.baseline_stockout_day != stockouts[key]:
            raise RunMismatch("Pinned inputs do not match recorded run")
        effects.append(
            ModeledEffect(
                id=item.id,
                baseline_stockout_day=stockouts[key],
                counterfactual_stockout_day=effect.counterfactual_stockout_day,
                deferred_days=effect.deferred_days,
            )
        )
        candidates.append(Candidate(item.id, item.cost, effect.deferred_days, group=key))
    return select_actions(
        candidates, budget=request.budget, minimum_benefit=request.minimum_benefit
    ), effects
