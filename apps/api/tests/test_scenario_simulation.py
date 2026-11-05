import pytest

from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.scenario import simulate_scenario


def test_scenario_run_is_reproducible_and_ordered() -> None:
    scenario = ScenarioCreate(
        name="Synthetic shock", shock_type="logistics_reduction", magnitude=40
    )
    result = simulate_scenario(scenario, seed=42, horizon_days=90)
    assert result == simulate_scenario(scenario, seed=42, horizon_days=90)
    assert result["synthetic"] is True
    assert result["stockouts"]
    assert [item["day"] for item in result["stockouts"]] == sorted(
        item["day"] for item in result["stockouts"]
    )


def test_delay_causes_stockout_and_rejects_unbounded_horizon() -> None:
    scenario = ScenarioCreate(name="Synthetic delay", shock_type="cash_delay", magnitude=45)
    assert simulate_scenario(scenario, seed=1, horizon_days=90)["stockouts"]
    with pytest.raises(ValueError):
        simulate_scenario(scenario, seed=1, horizon_days=0)
