from unittest.mock import patch

import pytest

from dawa_api.ingestion.synthetic import generate_dataset
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.scenario import simulate_scenario


def test_scenario_run_is_reproducible_and_ordered() -> None:
    scenario = ScenarioCreate(
        name="Synthetic shock", shock_type="logistics_reduction", magnitude=40
    )
    result = simulate_scenario(scenario, seed=42, horizon_days=90)
    assert result == simulate_scenario(scenario, seed=42, horizon_days=90)
    assert result["synthetic"] is True
    assert result["simulation_version"] == 3
    assert result["stockouts"]
    assert all(item["district_id"].startswith("SYN-KE-D") for item in result["stockouts"])
    assert result["district_stockouts"]
    assert [item["day"] for item in result["district_stockouts"]] == sorted(
        item["day"] for item in result["district_stockouts"]
    )
    for district in result["district_stockouts"]:
        matching = [
            item["day"]
            for item in result["stockouts"]
            if item["district_id"] == district["district_id"]
            and item["commodity_id"] == district["commodity_id"]
        ]
        assert district["day"] == min(matching)
    assert [item["day"] for item in result["stockouts"]] == sorted(
        item["day"] for item in result["stockouts"]
    )


def test_delay_causes_stockout_and_rejects_unbounded_horizon() -> None:
    scenario = ScenarioCreate(name="Synthetic delay", shock_type="cash_delay", magnitude=45)
    assert simulate_scenario(scenario, seed=1, horizon_days=90)["stockouts"]
    with pytest.raises(ValueError):
        simulate_scenario(scenario, seed=1, horizon_days=0)


def test_run_uses_supplied_snapshot_without_regeneration() -> None:
    scenario = ScenarioCreate(name="Synthetic delay", shock_type="cash_delay", magnitude=45)
    snapshot = generate_dataset(seed=42)
    with patch(
        "dawa_api.simulation.scenario.generate_dataset", side_effect=AssertionError("regenerated")
    ):
        result = simulate_scenario(scenario, seed=42, horizon_days=90, dataset=snapshot)
    assert result["synthetic"] is True and result["stockouts"]


def test_legacy_simulation_version_remains_available() -> None:
    scenario = ScenarioCreate(name="Synthetic delay", shock_type="cash_delay", magnitude=45)
    result = simulate_scenario(scenario, seed=42, horizon_days=90, simulation_version=1)
    assert "simulation_version" not in result
    assert "district_stockouts" not in result
    assert all("district_id" not in item for item in result["stockouts"])
    with pytest.raises(ValueError):
        simulate_scenario(scenario, seed=42, horizon_days=90, simulation_version=999)


def test_version_three_uses_snapshot_lead_times_for_delivery_schedule() -> None:
    scenario = ScenarioCreate(name="No delay", shock_type="cash_delay", magnitude=0)
    data = {
        "synthetic": True,
        "country_code": "KE",
        "seed": 3,
        "facilities": [{"id": "f", "lead_time_days": 5}],
        "consumption": [
            {"facility_id": "f", "commodity_id": "c", "month_index": 23, "quantity": 300}
        ],
    }
    fast = simulate_scenario(scenario, seed=3, horizon_days=60, dataset=data, simulation_version=3)
    legacy_fast = simulate_scenario(
        scenario, seed=3, horizon_days=60, dataset=data, simulation_version=2
    )
    data["facilities"][0]["lead_time_days"] = 40
    slow = simulate_scenario(scenario, seed=3, horizon_days=60, dataset=data, simulation_version=3)
    legacy_slow = simulate_scenario(
        scenario, seed=3, horizon_days=60, dataset=data, simulation_version=2
    )
    assert fast["stockouts"] == []
    assert slow["stockouts"][0]["day"] == 30
    assert legacy_fast == legacy_slow
