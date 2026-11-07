from math import asin, cos, radians, sin, sqrt

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from dawa_api.ingestion.kisumu import generate_kisumu_panel
from dawa_api.optimization.mitigation import rank_deliveries
from dawa_api.optimization.modeled_schemas import ModeledRequest
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.kisumu import simulate_kisumu


def test_kisumu_panel_is_deterministic_and_has_only_kisumu_facilities() -> None:
    data = generate_kisumu_panel(seed=42)
    assert data == generate_kisumu_panel(seed=42)
    assert data != generate_kisumu_panel(seed=43)
    assert data["synthetic"] is True
    assert data["county_code"] == "042"
    assert len(data["subcounties"]) == 7
    assert len(data["facilities"]) == 40
    assert all(facility["county_code"] == "042" for facility in data["facilities"])
    assert {c["category"] for c in data["commodities"]} >= {"antiretroviral", "antimalarial"}
    assert len(data["commodities"]) == 10


@given(seed=st.integers(min_value=0, max_value=2**31 - 1))
@settings(max_examples=20, deadline=None)
def test_synthetic_coordinates_are_reproducible_clustered_and_match_planted_route(
    seed: int,
) -> None:
    data = generate_kisumu_panel(seed=seed, version=3)
    facilities = data["facilities"]
    assert facilities == generate_kisumu_panel(seed=seed, version=3)["facilities"]
    assert facilities != generate_kisumu_panel(seed=seed + 1, version=3)["facilities"]
    points = [(f["latitude"], f["longitude"]) for f in facilities]
    assert len(set(points)) == 40
    assert all(-0.35 <= lat <= 0.10 and 34.4 <= lon <= 35.2 for lat, lon in points)
    assert all(f["coordinates_synthetic"] is True for f in facilities)

    def distance(a: tuple[float, float], b: tuple[float, float]) -> float:
        lat1, lon1, lat2, lon2 = map(radians, (*a, *b))
        arc = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
        return 2 * 6371 * asin(sqrt(arc))

    for group in data["subcounties"]:
        group_points = [
            (f["latitude"], f["longitude"]) for f in facilities if f["subcounty_id"] == group["id"]
        ]
        assert max(distance(a, b) for a in group_points for b in group_points) < 2
    route = data["demo_cases"]["near_expiry_transfer"]
    indexed = {f["id"]: (f["latitude"], f["longitude"]) for f in facilities}
    assert (
        abs(
            distance(indexed[route["donor_facility_id"]], indexed[route["facility_id"]])
            - route["distance_km"]
        )
        < 1
    )
    old = generate_kisumu_panel(seed=seed, version=2)
    assert all(
        "latitude" not in facility and "longitude" not in facility for facility in old["facilities"]
    )


def test_planted_kisumu_cases_have_consistent_synthetic_records() -> None:
    data = generate_kisumu_panel(seed=42)
    demo = data["demo_cases"]
    assert demo["chronic_stockout"]["facility_id"] in {f["id"] for f in data["facilities"]}
    transfer = demo["near_expiry_transfer"]
    assert transfer["distance_km"] <= transfer["maximum_distance_km"]
    assert transfer["expiry_day"] > transfer["arrival_day"] + transfer["minimum_shelf_days"]
    assert transfer["available_units"] >= transfer["quantity"] > 0
    assert demo["stalled_release"]["approved"] > 0
    assert demo["stalled_release"]["released"] == 0


def test_planted_cases_appear_in_40_percent_kisumu_scenario() -> None:
    data = generate_kisumu_panel(seed=42)
    scenario = ScenarioCreate(
        name="Synthetic donor logistics shock", shock_type="logistics_reduction", magnitude=40
    )
    result = simulate_kisumu(scenario, data, horizon_days=90)
    assert result["synthetic"] is True
    assert result["county_code"] == "042"
    assert result["pre_shock_stockouts"][0]["facility_id"] == "SYN-KE-042-F001"
    assert result["pre_shock_stockouts"][0]["commodity_id"] == "SYN-C01"
    first_shock = result["shock_caused_stockouts"][0]
    assert (first_shock["facility_id"], first_shock["commodity_id"], first_shock["day"]) == (
        "SYN-KE-042-F001",
        "SYN-C02",
        48,
    )
    assert first_shock["no_shock_stockout_day"] is None
    cases = data["demo_cases"]
    for case in (cases["chronic_stockout"], cases["near_expiry_transfer"]):
        assert any(
            item["facility_id"] == case["facility_id"]
            and item["commodity_id"] == case["commodity_id"]
            for item in result["stockouts"]
        )
    assert result["demo_cases"]["stalled_release"]["released"] == 0
    assert result["demo_cases"]["near_expiry_transfer"]["available_units"] >= 100
    assert sum(row["stockout_count"] for row in result["subcounty_rollup"]) == len(
        result["stockouts"]
    )


def test_kisumu_simulator_rejects_foreign_county_facility() -> None:
    data = generate_kisumu_panel(seed=42)
    data["facilities"][0]["county_code"] = "047"
    scenario = ScenarioCreate(name="synthetic", shock_type="logistics_reduction", magnitude=40)
    with pytest.raises(ValueError, match="Kisumu"):
        simulate_kisumu(scenario, data, horizon_days=90)
    data = generate_kisumu_panel(seed=42)
    data["consumption"][0]["county_code"] = "047"
    with pytest.raises(ValueError, match="Kisumu"):
        simulate_kisumu(scenario, data, horizon_days=90)


def test_zero_shock_has_no_shock_caused_events_and_version_one_stays_compatible() -> None:
    data = generate_kisumu_panel(seed=42)
    scenario = ScenarioCreate(name="synthetic", shock_type="logistics_reduction", magnitude=0)
    current = simulate_kisumu(scenario, data, horizon_days=90)
    assert current["shock_caused_stockouts"] == []
    legacy = simulate_kisumu(scenario, data, horizon_days=90, simulation_version=1)
    assert "shock_caused_stockouts" not in legacy
    assert legacy["stockouts"] == current["stockouts"]


@given(seed=st.integers(min_value=0, max_value=1000), magnitude=st.integers(0, 100))
@settings(max_examples=20, deadline=None)
def test_subcounty_rollups_equal_facility_stockouts(seed: int, magnitude: int) -> None:
    scenario = ScenarioCreate(
        name="synthetic", shock_type="logistics_reduction", magnitude=magnitude
    )
    result = simulate_kisumu(scenario, generate_kisumu_panel(seed=seed), horizon_days=90)
    for row in result["subcounty_rollup"]:
        assert row["stockout_count"] == sum(
            1 for item in result["stockouts"] if item["subcounty_id"] == row["subcounty_id"]
        )


def test_planted_transfer_is_ranked_against_emergency_procurement() -> None:
    data = generate_kisumu_panel(seed=42)
    scenario = ScenarioCreate(
        name="Synthetic donor shock", shock_type="logistics_reduction", magnitude=40
    )
    result = simulate_kisumu(scenario, data, horizon_days=90)
    transfer = data["demo_cases"]["near_expiry_transfer"]
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
                    "facility_id": transfer["facility_id"],
                    "donor_facility_id": transfer["donor_facility_id"],
                    "commodity_id": transfer["commodity_id"],
                    "quantity": transfer["quantity"],
                    "available_units": transfer["available_units"],
                    "dispatch_day": transfer["dispatch_day"],
                    "arrival_day": transfer["arrival_day"],
                    "expiry_day": transfer["expiry_day"],
                    "minimum_shelf_days": transfer["minimum_shelf_days"],
                    "distance_km": transfer["distance_km"],
                    "max_distance_km": transfer["maximum_distance_km"],
                },
                {
                    "id": "emergency",
                    "kind": "emergency_procurement",
                    "cost": 50,
                    "facility_id": transfer["facility_id"],
                    "commodity_id": transfer["commodity_id"],
                    "quantity": transfer["quantity"],
                    "arrival_day": transfer["arrival_day"],
                },
            ],
        }
    )
    ranked, effects = rank_deliveries(
        scenario, data, result["stockouts"], horizon_days=90, request=request, simulation_version=5
    )
    assert ranked.selected_ids == ("transfer",)
    assert ranked.total_cost == 10
    assert effects[0].deferred_days >= 1
