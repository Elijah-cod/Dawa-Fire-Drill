"""Replay assumed synthetic interventions through the pinned stock-flow model."""

from dataclasses import dataclass
from typing import Any

from dawa_api.optimization.modeled_schemas import (
    ModeledDelivery,
    ModeledEffect,
    ModeledReorder,
    ModeledRequest,
)
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
    simulation_version: int,
) -> tuple[int, dict[int, int], int]:
    if data.get("synthetic") is not True or data.get("country_code") != "KE":
        raise ValueError("A synthetic Kenya snapshot is required")
    facilities = [item for item in data["facilities"] if item["id"] == facility_id]
    if len(facilities) != 1:
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
    demand, deliveries = stock_parameters(
        scenario,
        monthly_demand=history[0]["quantity"],
        horizon_days=horizon_days,
        simulation_version=4 if simulation_version == 5 else simulation_version,
        lead_time_days=facilities[0].get("lead_time_days"),
    )
    if simulation_version == 5:
        if data.get("county_code") != "042" or facilities[0].get("county_code") != "042":
            raise ValueError("Kisumu synthetic snapshot required")
        opening = [
            row["opening_stock"]
            for row in data["stock"]
            if row["facility_id"] == facility_id and row["commodity_id"] == commodity_id
        ]
        if len(opening) != 1 or opening[0] < 0:
            raise ValueError("Synthetic opening stock is unavailable")
        return demand, deliveries, opening[0] * 30
    return demand, deliveries, demand * 30


def _compare(
    demand: int,
    deliveries: dict[int, int],
    changed: dict[int, int],
    horizon_days: int,
    opening_stock: int,
) -> DeliveryEffect:
    baseline = simulate_stock(
        opening_stock=opening_stock, daily_demand=demand, days=horizon_days, deliveries=deliveries
    ).stockout_day
    counterfactual = simulate_stock(
        opening_stock=opening_stock, daily_demand=demand, days=horizon_days, deliveries=changed
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
    simulation_version: int = 2,
) -> DeliveryEffect:
    """Compare first stockout dates, treating no stockout as horizon plus one."""
    if not 1 <= arrival_day <= horizon_days or not 1 <= quantity <= 1_000_000_000:
        raise ValueError("Delivery timing or quantity is outside supported bounds")
    demand, deliveries, opening_stock = _stock_inputs(
        scenario,
        data,
        horizon_days=horizon_days,
        facility_id=facility_id,
        commodity_id=commodity_id,
        simulation_version=simulation_version,
    )
    changed = deliveries.copy()
    changed[arrival_day] = changed.get(arrival_day, 0) + quantity * (
        30 if simulation_version in (4, 5) else 1
    )
    return _compare(demand, deliveries, changed, horizon_days, opening_stock)


def evaluate_reorder(
    scenario: ScenarioCreate,
    data: dict[str, Any],
    *,
    horizon_days: int,
    facility_id: str,
    commodity_id: str,
    original_day: int,
    arrival_day: int,
    simulation_version: int = 2,
) -> DeliveryEffect:
    """Move an existing modeled replenishment earlier without adding units."""
    demand, deliveries, opening_stock = _stock_inputs(
        scenario,
        data,
        horizon_days=horizon_days,
        facility_id=facility_id,
        commodity_id=commodity_id,
        simulation_version=simulation_version,
    )
    if original_day not in deliveries or not 1 <= arrival_day < original_day:
        raise ValueError("Reorder must advance an existing in-horizon delivery")
    changed = deliveries.copy()
    quantity = changed.pop(original_day)
    changed[arrival_day] = changed.get(arrival_day, 0) + quantity
    return _compare(demand, deliveries, changed, horizon_days, opening_stock)


def donor_safe_capacity(
    scenario: ScenarioCreate,
    data: dict[str, Any],
    *,
    horizon_days: int,
    facility_id: str,
    commodity_id: str,
    dispatch_day: int,
    simulation_version: int = 2,
) -> int:
    """Conservatively avoid advancing the donor's baseline first stockout."""
    if not 1 <= dispatch_day <= horizon_days:
        raise ValueError("Dispatch day is outside the run horizon")
    demand, deliveries, opening_stock = _stock_inputs(
        scenario,
        data,
        horizon_days=horizon_days,
        facility_id=facility_id,
        commodity_id=commodity_id,
        simulation_version=simulation_version,
    )
    baseline = simulate_stock(
        opening_stock=opening_stock, daily_demand=demand, days=horizon_days, deliveries=deliveries
    ).stockout_day
    last_day = (baseline - 1) if baseline is not None else horizon_days
    if dispatch_day > last_day:
        return 0
    stock = opening_stock
    capacity = 30_000_000_000 if simulation_version in (4, 5) else 1_000_000_000
    for day in range(1, last_day + 1):
        stock = max(0, stock + deliveries.get(day, 0) - demand)
        if day >= dispatch_day:
            capacity = min(capacity, max(0, stock - 1))
    return capacity // 30 if simulation_version in (4, 5) else capacity


def rank_deliveries(
    scenario: ScenarioCreate,
    snapshot: dict[str, Any],
    recorded: list[dict[str, Any]],
    *,
    horizon_days: int,
    request: ModeledRequest,
    simulation_version: int = 2,
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
                simulation_version=simulation_version,
            )
        elif isinstance(item, ModeledReorder):
            effect = evaluate_reorder(
                scenario,
                snapshot,
                horizon_days=horizon_days,
                facility_id=item.facility_id,
                commodity_id=item.commodity_id,
                arrival_day=item.arrival_day,
                original_day=item.original_day,
                simulation_version=simulation_version,
            )
        else:
            if (
                item.donor_facility_id == item.facility_id
                or item.dispatch_day > item.arrival_day
                or item.distance_km > item.max_distance_km
                or item.expiry_day <= item.arrival_day + item.minimum_shelf_days
            ):
                raise ValueError("Redistribution violates donor, timing, distance, or shelf life")
            effect = evaluate_delivery(
                scenario,
                snapshot,
                horizon_days=horizon_days,
                facility_id=item.facility_id,
                commodity_id=item.commodity_id,
                arrival_day=item.arrival_day,
                quantity=item.quantity,
                simulation_version=simulation_version,
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
        if isinstance(item, (ModeledDelivery, ModeledReorder)):
            candidates.append(Candidate(item.id, item.cost, effect.deferred_days, group=key))
        else:
            safe = donor_safe_capacity(
                scenario,
                snapshot,
                horizon_days=horizon_days,
                facility_id=item.donor_facility_id,
                commodity_id=item.commodity_id,
                dispatch_day=item.dispatch_day,
                simulation_version=simulation_version,
            )
            candidates.append(
                Candidate(
                    item.id,
                    item.cost,
                    effect.deferred_days,
                    group=key,
                    resource=(item.donor_facility_id, item.commodity_id),
                    resource_units=item.quantity,
                    resource_capacity=min(safe, item.available_units),
                )
            )
    return select_actions(
        candidates, budget=request.budget, minimum_benefit=request.minimum_benefit
    ), effects
