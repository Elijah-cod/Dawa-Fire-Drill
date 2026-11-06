import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from dawa_api.ingestion.kisumu import generate_kisumu_panel
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
