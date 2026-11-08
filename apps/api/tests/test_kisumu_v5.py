"""Version 5 spreads synthetic stock cover so shock-caused stockouts have a meaningful order."""

from collections import Counter

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from dawa_api.ingestion.county_repository import COUNTY_GENERATOR_VERSION
from dawa_api.ingestion.kisumu import generate_kisumu_panel
from dawa_api.optimization.kisumu import rank_kisumu
from dawa_api.optimization.modeled_schemas import ModeledRequest
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.kisumu import simulate_kisumu


def shock(magnitude: int) -> ScenarioCreate:
    return ScenarioCreate(
        name="Synthetic donor shock", shock_type="logistics_reduction", magnitude=magnitude
    )


def test_v5_is_served_and_v4_stays_unchanged() -> None:
    assert COUNTY_GENERATOR_VERSION == 5
    old = simulate_kisumu(shock(40), generate_kisumu_panel(seed=42, version=4), horizon_days=90)
    first = old["shock_caused_stockouts"][0]
    assert (first["facility_id"], first["commodity_id"], first["day"]) == (
        "SYN-KE-042-F001",
        "SYN-C02",
        48,
    )
    assert "transfer_routes" not in generate_kisumu_panel(seed=42, version=4)["demo_cases"]


@pytest.mark.parametrize("magnitude", [40, 41])
def test_v5_shock_stockouts_spread_over_several_weeks(magnitude: int) -> None:
    data = generate_kisumu_panel(seed=42, version=5)
    assert data == generate_kisumu_panel(seed=42, version=5)
    days = [
        item["day"]
        for item in simulate_kisumu(shock(magnitude), data, horizon_days=90)[
            "shock_caused_stockouts"
        ]
    ]
    assert days == sorted(days)
    assert days[-1] - days[0] >= 28
    assert len({day // 7 for day in days}) >= 5
    assert max(Counter(days).values()) <= 0.15 * len(days)


def test_v5_keeps_planted_cases_and_no_shock_events_at_zero() -> None:
    data = generate_kisumu_panel(seed=42, version=5)
    stock = {(s["facility_id"], s["commodity_id"]): s["opening_stock"] for s in data["stock"]}
    assert stock[("SYN-KE-042-F001", "SYN-C01")] == 0
    assert stock[("SYN-KE-042-F003", "SYN-C01")] == 10
    baseline = simulate_kisumu(shock(0), data, horizon_days=90)
    assert baseline["shock_caused_stockouts"] == []
    assert baseline["pre_shock_stockouts"][0]["facility_id"] == "SYN-KE-042-F001"
    assert data["demo_cases"]["stalled_release"]["released"] == 0
    assert data["demo_cases"]["chronic_stockout"]["commodity_id"] == "SYN-C01"


def test_v5_planted_transfer_targets_the_first_shock_event_and_is_ranked() -> None:
    data = generate_kisumu_panel(seed=42, version=5)
    run = simulate_kisumu(shock(40), data, horizon_days=90)
    first = run["shock_caused_stockouts"][0]
    route = data["demo_cases"]["near_expiry_transfer"]
    assert data["demo_cases"]["transfer_routes"][0] == route
    assert (route["facility_id"], route["commodity_id"]) == (
        first["facility_id"],
        first["commodity_id"],
    )
    assert route["dispatch_day"] < route["arrival_day"] <= first["day"]
    assert route["distance_km"] <= route["maximum_distance_km"]
    assert route["expiry_day"] > route["arrival_day"] + route["minimum_shelf_days"]
    request = ModeledRequest.model_validate(
        {
            "synthetic_attested": True,
            "budget": 100,
            "minimum_benefit": 1,
            "candidates": [
                {
                    "id": "transfer",
                    "kind": "redistribution",
                    "cost": 10,
                    "facility_id": route["facility_id"],
                    "donor_facility_id": route["donor_facility_id"],
                    "commodity_id": route["commodity_id"],
                    "quantity": route["quantity"],
                    "available_units": route["available_units"],
                    "dispatch_day": route["dispatch_day"],
                    "arrival_day": route["arrival_day"],
                    "expiry_day": route["expiry_day"],
                    "minimum_shelf_days": route["minimum_shelf_days"],
                    "distance_km": route["distance_km"],
                    "max_distance_km": route["maximum_distance_km"],
                },
                {
                    "id": "emergency",
                    "kind": "emergency_procurement",
                    "cost": 50,
                    "facility_id": route["facility_id"],
                    "commodity_id": route["commodity_id"],
                    "quantity": route["quantity"],
                    "arrival_day": route["arrival_day"],
                },
            ],
        }
    )
    ranked, effects = rank_kisumu(shock(40), data, run, request=request, horizon_days=90)
    assert ranked.selected_ids == ("transfer",)
    assert ranked.excluded_reasons == {"emergency": "alternative_selected"}
    assert effects[0].deferred_days >= 1


@given(seed=st.integers(min_value=0, max_value=2**31 - 1))
@settings(max_examples=10, deadline=None)
def test_v5_is_reproducible_and_plants_the_first_event_for_any_seed(seed: int) -> None:
    data = generate_kisumu_panel(seed=seed, version=5)
    assert data == generate_kisumu_panel(seed=seed, version=5)
    first = simulate_kisumu(shock(40), data, horizon_days=90)["shock_caused_stockouts"][0]
    route = data["demo_cases"]["near_expiry_transfer"]
    assert (route["facility_id"], route["commodity_id"]) == (
        first["facility_id"],
        first["commodity_id"],
    )
