"""Run reproducible illustrative shocks over synthetic demo stock flows."""

from typing import TypedDict

from dawa_api.ingestion.synthetic import generate_dataset
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.service import simulate_stock


class Stockout(TypedDict):
    facility_id: str
    commodity_id: str
    day: int


class ScenarioResult(TypedDict):
    synthetic: bool
    notice: str
    seed: int
    horizon_days: int
    stockouts: list[Stockout]


def simulate_scenario(scenario: ScenarioCreate, *, seed: int, horizon_days: int) -> ScenarioResult:
    if not 1 <= horizon_days <= 365:
        raise ValueError("horizon_days must be between 1 and 365")
    data = generate_dataset(seed=seed)
    stockouts: list[Stockout] = []
    for item in data["consumption"]:
        if item["month_index"] != 23:
            continue
        daily_demand = max(1, item["quantity"] // 30)
        deliveries: dict[int, int] = {}
        for planned_day in range(28, horizon_days + 1, 30):
            day = planned_day + (scenario.magnitude if scenario.shock_type == "cash_delay" else 0)
            quantity = daily_demand * 30
            if scenario.shock_type == "logistics_reduction":
                quantity = quantity * (100 - scenario.magnitude) // 100
            if day <= horizon_days:
                deliveries[day] = deliveries.get(day, 0) + quantity
        result = simulate_stock(
            opening_stock=daily_demand * 30,
            daily_demand=daily_demand,
            days=horizon_days,
            deliveries=deliveries,
        )
        if result.stockout_day is not None:
            stockouts.append(
                {
                    "facility_id": item["facility_id"],
                    "commodity_id": item["commodity_id"],
                    "day": result.stockout_day,
                }
            )
    stockouts.sort(key=lambda item: (item["day"], item["facility_id"], item["commodity_id"]))
    return {
        "synthetic": True,
        "notice": "Illustrative and unvalidated; non-facility quantities are assumptions",
        "seed": seed,
        "horizon_days": horizon_days,
        "stockouts": stockouts,
    }
