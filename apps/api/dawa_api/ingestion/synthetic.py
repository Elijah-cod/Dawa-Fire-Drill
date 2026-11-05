"""Reproducible synthetic demo records; quantities are assumptions, not observations."""

import argparse
import json
import random
import sys
from typing import Any, TypedDict

# Approximate 2022 Kenya public-facility mix, with rare higher levels oversampled.
FACILITY_LEVELS = (2,) * 29 + (3,) * 7 + (4,) * 3 + (5,)
SEASONAL_INDEX = (90, 92, 96, 100, 105, 110, 112, 108, 103, 100, 96, 92)


class Facility(TypedDict):
    id: str
    country_code: str
    county: str
    level: int
    lead_time_days: int


class BudgetLine(TypedDict):
    id: str
    commodity_id: str
    approved: int


def generate_dataset(*, seed: int) -> dict[str, Any]:
    # Deterministic synthetic fixtures require reproducibility, not cryptographic randomness.
    rng = random.Random(seed)  # nosec B311
    levels = list(FACILITY_LEVELS)
    rng.shuffle(levels)
    facilities: list[Facility] = [
        {
            "id": f"SYN-KE-F{index:03d}",
            "country_code": "KE",
            "county": "Synthetic County",
            "level": level,
            "lead_time_days": rng.randint(7, 42),
        }
        for index, level in enumerate(levels, 1)
    ]
    commodities = [
        {"id": f"SYN-C{index:02d}", "name": f"Synthetic commodity {index:02d}"}
        for index in range(1, 11)
    ]
    consumption = []
    for facility in facilities:
        for commodity in commodities:
            baseline = rng.randint(10, 100) * facility["level"]
            for month in range(24):
                quantity = max(
                    0, baseline * SEASONAL_INDEX[month % 12] * rng.randint(90, 110) // 10000
                )
                consumption.append(
                    {
                        "facility_id": facility["id"],
                        "commodity_id": commodity["id"],
                        "month_index": month,
                        "quantity": quantity,
                    }
                )
    budget_lines: list[BudgetLine] = [
        {"id": f"SYN-B{index:02d}", "commodity_id": item["id"], "approved": rng.randint(1000, 5000)}
        for index, item in enumerate(commodities, 1)
    ]
    cash_releases = [
        {
            "budget_line_id": line["id"],
            "amount": line["approved"] * 4 // 5,
            "day": rng.randint(1, 30),
        }
        for line in budget_lines
    ]
    procurement_orders = [
        {
            "budget_line_id": line["id"],
            "amount": line["approved"] * 3 // 5,
            "delivery_day": rng.randint(31, 90),
        }
        for line in budget_lines
    ]
    return {
        "synthetic": True,
        "country_code": "KE",
        "seed": seed,
        "calibration_scope": "facility level mix only; other quantities are illustrative "
        "assumptions",
        "facilities": facilities,
        "commodities": commodities,
        "consumption": consumption,
        "budget_lines": budget_lines,
        "cash_releases": cash_releases,
        "procurement_orders": procurement_orders,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate illustrative synthetic Kenya demo data")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    json.dump(generate_dataset(seed=args.seed), sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
