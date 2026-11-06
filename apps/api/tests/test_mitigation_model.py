import pytest

from dawa_api.optimization.mitigation import evaluate_delivery, evaluate_reorder
from dawa_api.scenarios.schemas import ScenarioCreate


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
