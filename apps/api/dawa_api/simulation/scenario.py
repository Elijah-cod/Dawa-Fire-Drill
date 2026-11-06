"""Run reproducible illustrative shocks over synthetic demo stock flows."""

from typing import Any, NotRequired, TypedDict

from dawa_api.ingestion.synthetic import generate_dataset
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.service import simulate_stock

SIMULATION_VERSION = 4


class Stockout(TypedDict):
    facility_id: str
    district_id: NotRequired[str]
    commodity_id: str
    day: int


class DistrictStockout(TypedDict):
    district_id: str
    commodity_id: str
    day: int


class ScenarioResult(TypedDict):
    synthetic: bool
    notice: str
    seed: int
    simulation_version: NotRequired[int]
    horizon_days: int
    stockouts: list[Stockout]
    district_stockouts: NotRequired[list[DistrictStockout]]


def stock_parameters(
    scenario: ScenarioCreate,
    *,
    monthly_demand: int,
    horizon_days: int,
    simulation_version: int = 2,
    lead_time_days: int | None = None,
) -> tuple[int, dict[int, int]]:
    """Build version-pinned stock-flow inputs for a single commodity."""
    if monthly_demand < 0 or not 1 <= horizon_days <= 365:
        raise ValueError("Invalid demand or simulation horizon")
    daily_demand = monthly_demand if simulation_version == 4 else max(1, monthly_demand // 30)
    deliveries: dict[int, int] = {}
    if simulation_version not in (1, 2, 3, 4):
        raise ValueError("Unsupported simulation version")
    if simulation_version in (3, 4):
        if lead_time_days is None or not 1 <= lead_time_days <= 365:
            raise ValueError("Version 3 requires a valid synthetic lead time")
        first_day = 1 + lead_time_days
    else:
        first_day = 28
    for planned_day in range(first_day, horizon_days + 1, 30):
        day = planned_day + (scenario.magnitude if scenario.shock_type == "cash_delay" else 0)
        quantity = daily_demand * 30
        if scenario.shock_type == "logistics_reduction":
            quantity = quantity * (100 - scenario.magnitude) // 100
        if day <= horizon_days:
            deliveries[day] = deliveries.get(day, 0) + quantity
    return daily_demand, deliveries


def simulate_scenario(
    scenario: ScenarioCreate,
    *,
    seed: int,
    horizon_days: int,
    dataset: dict[str, Any] | None = None,
    simulation_version: int = SIMULATION_VERSION,
) -> ScenarioResult:
    if simulation_version not in (1, 2, 3, SIMULATION_VERSION):
        raise ValueError("Unsupported simulation version")
    if not 1 <= horizon_days <= 365:
        raise ValueError("horizon_days must be between 1 and 365")
    data = dataset if dataset is not None else generate_dataset(seed=seed)
    if (
        data.get("synthetic") is not True
        or data.get("country_code") != "KE"
        or data.get("seed") != seed
    ):
        raise ValueError("Scenario requires a matching synthetic Kenya snapshot")
    stockouts: list[Stockout] = []
    district_by_facility = {
        facility["id"]: f"SYN-KE-D{index // 8 + 1:02d}"
        for index, facility in enumerate(data["facilities"])
    }
    lead_by_facility = {
        facility["id"]: facility.get("lead_time_days") for facility in data["facilities"]
    }
    for item in data["consumption"]:
        if item["month_index"] != 23:
            continue
        daily_demand, deliveries = stock_parameters(
            scenario,
            monthly_demand=item["quantity"],
            horizon_days=horizon_days,
            simulation_version=simulation_version,
            lead_time_days=lead_by_facility[item["facility_id"]],
        )
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
                    "district_id": district_by_facility[item["facility_id"]],
                    "commodity_id": item["commodity_id"],
                    "day": result.stockout_day,
                }
            )
    stockouts.sort(key=lambda item: (item["day"], item["facility_id"], item["commodity_id"]))
    first_by_district: dict[tuple[str, str], int] = {}
    for item in stockouts:
        key = (item["district_id"], item["commodity_id"])
        first_by_district.setdefault(key, item["day"])
    district_stockouts: list[DistrictStockout] = [
        {"district_id": district, "commodity_id": commodity, "day": day}
        for (district, commodity), day in first_by_district.items()
    ]
    district_stockouts.sort(
        key=lambda item: (item["day"], item["district_id"], item["commodity_id"])
    )
    output: ScenarioResult = {
        "synthetic": True,
        "notice": "Illustrative and unvalidated; non-facility quantities are assumptions",
        "seed": seed,
        "simulation_version": simulation_version,
        "horizon_days": horizon_days,
        "stockouts": stockouts,
        "district_stockouts": district_stockouts,
    }
    if simulation_version == 1:
        output.pop("simulation_version")
        output.pop("district_stockouts")
        for stockout in output["stockouts"]:
            stockout.pop("district_id")
    return output
