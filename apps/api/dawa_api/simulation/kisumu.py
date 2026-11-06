"""Illustrative Kisumu-only simulation over explicit synthetic stock inputs."""

from collections import Counter
from typing import Any

from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.scenario import stock_parameters
from dawa_api.simulation.service import simulate_stock


def simulate_kisumu(
    scenario: ScenarioCreate, data: dict[str, Any], *, horizon_days: int
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
            events.append(
                {
                    "facility_id": key[0],
                    "subcounty_id": facility["subcounty_id"],
                    "commodity_id": key[1],
                    "day": result.stockout_day,
                }
            )
    events.sort(key=lambda item: (item["day"], item["facility_id"], item["commodity_id"]))
    counts = Counter(item["subcounty_id"] for item in events)
    return {
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
