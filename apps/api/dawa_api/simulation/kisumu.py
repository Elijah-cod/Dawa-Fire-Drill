"""Illustrative Kisumu-only simulation over explicit synthetic stock inputs."""

from collections import Counter
from typing import Any

from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.scenario import stock_parameters
from dawa_api.simulation.service import simulate_stock


def simulate_kisumu(
    scenario: ScenarioCreate,
    data: dict[str, Any],
    *,
    horizon_days: int,
    simulation_version: int = 2,
) -> dict[str, Any]:
    """Run a synthetic pilot locally; never accept non-Kisumu facility inputs."""
    if (
        data.get("synthetic") is not True
        or data.get("country_code") != "KE"
        or data.get("county_code") != "042"
    ):
        raise ValueError("A synthetic Kisumu snapshot is required")
    if not 1 <= horizon_days <= 365:
        raise ValueError("Invalid horizon")
    if simulation_version not in (1, 2):
        raise ValueError("Unsupported Kisumu simulation version")
    facilities = {item["id"]: item for item in data["facilities"]}
    if any(
        item["county_code"] != "042" or item["country_code"] != "KE" for item in facilities.values()
    ):
        raise ValueError("Only Kisumu facilities may be simulated")
    if any(
        item["county_code"] != "042" or item["country_code"] != "KE" for item in data["consumption"]
    ):
        raise ValueError("Only Kisumu consumption may be simulated")
    stock = {
        (item["facility_id"], item["commodity_id"]): item["opening_stock"] for item in data["stock"]
    }
    events: list[dict[str, Any]] = []
    pre_shock: list[dict[str, Any]] = []
    shock_caused: list[dict[str, Any]] = []
    baseline_stockouts: list[dict[str, Any]] = []
    no_shock = scenario.model_copy(update={"magnitude": 0})
    for item in data["consumption"]:
        if item["month_index"] != 23:
            continue
        key = (item["facility_id"], item["commodity_id"])
        facility = facilities[key[0]]
        demand, deliveries = stock_parameters(
            scenario,
            monthly_demand=item["quantity"],
            horizon_days=horizon_days,
            simulation_version=4,
            lead_time_days=facility["lead_time_days"],
        )
        result = simulate_stock(
            opening_stock=stock[key] * 30,
            daily_demand=demand,
            days=horizon_days,
            deliveries=deliveries,
        )
        if result.stockout_day is not None:
            event = {
                "facility_id": key[0],
                "subcounty_id": facility["subcounty_id"],
                "commodity_id": key[1],
                "day": result.stockout_day,
            }
            events.append(event)
            if simulation_version == 2:
                _, baseline_deliveries = stock_parameters(
                    no_shock,
                    monthly_demand=item["quantity"],
                    horizon_days=horizon_days,
                    simulation_version=4,
                    lead_time_days=facility["lead_time_days"],
                )
                baseline = simulate_stock(
                    opening_stock=stock[key] * 30,
                    daily_demand=demand,
                    days=horizon_days,
                    deliveries=baseline_deliveries,
                ).stockout_day
                compared = {**event, "no_shock_stockout_day": baseline}
                if stock[key] == 0:
                    pre_shock.append(compared)
                elif baseline is None or result.stockout_day < baseline:
                    shock_caused.append(compared)
                else:
                    baseline_stockouts.append(compared)
    events.sort(key=lambda item: (item["day"], item["facility_id"], item["commodity_id"]))
    counts = Counter(item["subcounty_id"] for item in events)
    output = {
        "synthetic": True,
        "country_code": "KE",
        "county_code": "042",
        "notice": "Illustrative and unvalidated synthetic Kisumu simulation",
        "horizon_days": horizon_days,
        "stockouts": events,
        "subcounty_rollup": [
            {"subcounty_id": item["id"], "stockout_count": counts[item["id"]]}
            for item in data["subcounties"]
        ],
        "demo_cases": data["demo_cases"],
    }
    if simulation_version == 2:
        for group in (pre_shock, shock_caused, baseline_stockouts):
            group.sort(key=lambda item: (item["day"], item["facility_id"], item["commodity_id"]))
        output.update(
            pre_shock_stockouts=pre_shock,
            shock_caused_stockouts=shock_caused,
            baseline_stockouts=baseline_stockouts,
        )
    return output
