import pytest
from hypothesis import given
from hypothesis import strategies as st

from dawa_api.optimization.mitigation import (
    donor_safe_capacity,
    evaluate_delivery,
    evaluate_reorder,
    rank_deliveries,
)
from dawa_api.optimization.modeled_schemas import ModeledRequest
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.scenario import stock_parameters
from dawa_api.simulation.service import simulate_stock


def test_extra_delivery_is_replayed_against_synthetic_shock() -> None:
    scenario = ScenarioCreate(name="Synthetic delay", shock_type="cash_delay", magnitude=45)
    data = {
        "synthetic": True,
        "country_code": "KE",
        "seed": 1,
        "facilities": [{"id": "SYN-F1"}],
        "consumption": [
            {"facility_id": "SYN-F1", "commodity_id": "SYN-C1", "month_index": 23, "quantity": 300}
        ],
    }
    early = evaluate_delivery(
        scenario,
        data,
        horizon_days=60,
        facility_id="SYN-F1",
        commodity_id="SYN-C1",
        arrival_day=20,
        quantity=100,
    )
    assert early.baseline_stockout_day == 30
    assert early.counterfactual_stockout_day == 40
    assert early.deferred_days == 10
    late = evaluate_delivery(
        scenario,
        data,
        horizon_days=60,
        facility_id="SYN-F1",
        commodity_id="SYN-C1",
        arrival_day=31,
        quantity=100,
    )
    assert late.deferred_days == 0


def test_fractional_daily_demand_preserves_one_month_of_extra_stock() -> None:
    scenario = ScenarioCreate(name="Synthetic delay", shock_type="cash_delay", magnitude=90)
    data = {
        "synthetic": True,
        "country_code": "KE",
        "facilities": [{"id": "f", "lead_time_days": 20}],
        "consumption": [
            {"facility_id": "f", "commodity_id": "c", "month_index": 23, "quantity": 1}
        ],
    }
    effect = evaluate_delivery(
        scenario,
        data,
        horizon_days=90,
        facility_id="f",
        commodity_id="c",
        arrival_day=1,
        quantity=1,
        simulation_version=4,
    )
    assert effect.baseline_stockout_day == 30
    assert effect.counterfactual_stockout_day == 60


def test_delivery_requires_existing_facility_commodity_and_valid_timing() -> None:
    scenario = ScenarioCreate(name="delay", shock_type="cash_delay", magnitude=45)
    data = {"synthetic": True, "country_code": "KE", "seed": 1, "facilities": [], "consumption": []}
    with pytest.raises(ValueError):
        evaluate_delivery(
            scenario,
            data,
            horizon_days=60,
            facility_id="missing",
            commodity_id="x",
            arrival_day=1,
            quantity=1,
        )


def test_reorder_moves_existing_delivery_without_adding_stock() -> None:
    scenario = ScenarioCreate(name="Synthetic delay", shock_type="cash_delay", magnitude=45)
    data = {
        "synthetic": True,
        "country_code": "KE",
        "facilities": [{"id": "SYN-F1"}],
        "consumption": [
            {"facility_id": "SYN-F1", "commodity_id": "SYN-C1", "month_index": 23, "quantity": 300}
        ],
    }
    effect = evaluate_reorder(
        scenario,
        data,
        horizon_days=90,
        facility_id="SYN-F1",
        commodity_id="SYN-C1",
        original_day=73,
        arrival_day=28,
    )
    assert effect.baseline_stockout_day == 30
    assert effect.counterfactual_stockout_day == 60
    assert effect.deferred_days == 30
    with pytest.raises(ValueError):
        evaluate_reorder(
            scenario,
            data,
            horizon_days=90,
            facility_id="SYN-F1",
            commodity_id="SYN-C1",
            original_day=74,
            arrival_day=28,
        )


def test_donor_capacity_preserves_its_baseline_first_stockout() -> None:
    scenario = ScenarioCreate(name="Synthetic delay", shock_type="cash_delay", magnitude=45)
    data = {
        "synthetic": True,
        "country_code": "KE",
        "facilities": [{"id": "SYN-F1"}],
        "consumption": [
            {"facility_id": "SYN-F1", "commodity_id": "SYN-C1", "month_index": 23, "quantity": 300}
        ],
    }
    assert (
        donor_safe_capacity(
            scenario,
            data,
            horizon_days=60,
            facility_id="SYN-F1",
            commodity_id="SYN-C1",
            dispatch_day=10,
        )
        == 9
    )
    assert (
        donor_safe_capacity(
            scenario,
            data,
            horizon_days=60,
            facility_id="SYN-F1",
            commodity_id="SYN-C1",
            dispatch_day=30,
        )
        == 0
    )


def test_redistribution_replay_shares_donor_stock_and_rejects_bad_routes() -> None:
    scenario = ScenarioCreate(name="delay", shock_type="cash_delay", magnitude=45)
    data = {
        "synthetic": True,
        "country_code": "KE",
        "facilities": [{"id": f} for f in ("donor", "a", "b")],
        "consumption": [
            {
                "facility_id": f,
                "commodity_id": "c",
                "month_index": 23,
                "quantity": 900 if f == "donor" else 300,
            }
            for f in ("donor", "a", "b")
        ],
    }
    base = {
        "kind": "redistribution",
        "commodity_id": "c",
        "donor_facility_id": "donor",
        "cost": 1,
        "dispatch_day": 10,
        "arrival_day": 11,
        "quantity": 20,
        "available_units": 100,
        "expiry_day": 50,
        "minimum_shelf_days": 5,
        "distance_km": 10,
        "max_distance_km": 20,
    }
    request = ModeledRequest.model_validate(
        {
            "synthetic_attested": True,
            "budget": 2,
            "candidates": [
                base | {"id": "a", "facility_id": "a"},
                base | {"id": "b", "facility_id": "b"},
            ],
        }
    )
    recorded = [{"facility_id": f, "commodity_id": "c", "day": 30} for f in ("a", "b")]
    result, _ = rank_deliveries(scenario, data, recorded, horizon_days=60, request=request)
    assert len(result.selected_ids) == 1
    bad = ModeledRequest.model_validate(
        {
            "synthetic_attested": True,
            "budget": 2,
            "candidates": [base | {"id": "a", "facility_id": "a", "distance_km": 21}],
        }
    )
    with pytest.raises(ValueError, match="distance"):
        rank_deliveries(scenario, data, recorded, horizon_days=60, request=bad)


@given(
    monthly=st.integers(min_value=0, max_value=300),
    dispatch=st.integers(min_value=1, max_value=60),
    reduction=st.integers(min_value=0, max_value=100),
)
def test_donor_safe_capacity_never_advances_baseline_stockout(
    monthly: int,
    dispatch: int,
    reduction: int,
) -> None:
    scenario = ScenarioCreate(
        name="synthetic", shock_type="logistics_reduction", magnitude=reduction
    )
    data = {
        "synthetic": True,
        "country_code": "KE",
        "facilities": [{"id": "f", "lead_time_days": 24}],
        "consumption": [
            {"facility_id": "f", "commodity_id": "c", "month_index": 23, "quantity": monthly}
        ],
    }
    safe = donor_safe_capacity(
        scenario,
        data,
        horizon_days=60,
        facility_id="f",
        commodity_id="c",
        dispatch_day=dispatch,
        simulation_version=4,
    )
    demand, deliveries = stock_parameters(
        scenario, monthly_demand=monthly, horizon_days=60, simulation_version=4, lead_time_days=24
    )
    baseline = simulate_stock(
        opening_stock=demand * 30, daily_demand=demand, days=60, deliveries=deliveries
    ).stockout_day
    stock = demand * 30
    first = None
    for day in range(1, 61):
        stock += deliveries.get(day, 0)
        if day == dispatch:
            assert safe * 30 <= stock
            stock -= safe * 30
        stock = max(0, stock - demand)
        if demand and stock == 0 and first is None:
            first = day
    assert (first or 61) >= (baseline or 61)
