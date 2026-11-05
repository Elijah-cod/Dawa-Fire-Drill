from datetime import date

import pytest
from hypothesis import given
from hypothesis import strategies as st

from dawa_api.finance_flow.service import FundingRecord, diagnose
from dawa_api.forecasting.service import forecast
from dawa_api.redistribution.service import FacilityStock, suggest_transfer


def test_funding_diagnoses_each_stage_and_age() -> None:
    record = FundingRecord(
        approved=100, released=80, procured=50, delivered=40, since=date(2026, 1, 1)
    )
    findings = diagnose(record, as_of=date(2026, 1, 11))
    assert [(f.stage, f.amount, f.age_days) for f in findings] == [
        ("approved_not_released", 20, 10),
        ("released_not_procured", 30, 10),
        ("procured_not_delivered", 10, 10),
    ]


def test_funding_rejects_inconsistent_flow() -> None:
    with pytest.raises(ValueError):
        diagnose(FundingRecord(10, 11, 0, 0, date(2026, 1, 1)), as_of=date(2026, 1, 2))


def test_forecast_uses_average_and_lead_time() -> None:
    result = forecast([10, 20, 30], lead_time_periods=2, safety_periods=1)
    assert result.average_demand == 20
    assert result.reorder_point == 60


def test_forecast_projects_stockout_in_input_periods_without_incoming_stock() -> None:
    result = forecast([10, 20, 30], lead_time_periods=2, safety_periods=1, stock_on_hand=45)
    assert result.stockout_period == 3
    assert (
        forecast([0, 0], lead_time_periods=1, safety_periods=0, stock_on_hand=5).stockout_period
        is None
    )
    assert (
        forecast([1], lead_time_periods=1, safety_periods=0, stock_on_hand=0).stockout_period == 0
    )


@given(available=st.integers(0, 1000), needed=st.integers(0, 1000))
def test_transfer_never_exceeds_available_or_needed(available: int, needed: int) -> None:
    source = FacilityStock("source", available, 30)
    target = FacilityStock("target", 0, 0)
    result = suggest_transfer(
        source,
        target,
        needed=needed,
        distance_km=10,
        max_distance_km=20,
        minimum_shelf_life_days=14,
    )
    assert result.quantity <= min(available, needed)


def test_transfer_rejects_expired_or_distant_stock() -> None:
    source = FacilityStock("source", 20, 2)
    target = FacilityStock("target", 0, 0)
    result = suggest_transfer(
        source, target, needed=10, distance_km=50, max_distance_km=20, minimum_shelf_life_days=14
    )
    assert result.quantity == 0
    assert set(result.reasons) == {"distance_exceeded", "shelf_life_too_short"}
