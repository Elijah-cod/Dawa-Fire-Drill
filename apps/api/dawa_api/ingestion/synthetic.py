"""Reproducible synthetic demo records; quantities are assumptions, not observations."""

import argparse
import json
import random
import sys
from typing import Any, TypedDict

# Approximate 2022 Kenya public-facility mix, with rare higher levels oversampled.
FACILITY_LEVELS = (2,) * 29 + (3,) * 7 + (4,) * 3 + (5,)
SEASONAL_INDEX = (90, 92, 96, 100, 105, 110, 112, 108, 103, 100, 96, 92)
TURNAROUND_SOURCE = (
    "https://www.treasury.go.ke/sites/default/files/NEW/Draft-Health-Sector-Report-11.11.2025.pdf"
)
MALARIA_SOURCE = "https://www.pmi.gov/wp-content/uploads/2022/01/FY-2022-Kenya-MOP.pdf"
MALARIA_NEEDS = {
    "SYN-C01": 6_067_513,
    "SYN-C02": 9_649_693,
    "SYN-C03": 1_087_808,
    "SYN-C10": 1_241_175,
}
FAMILY_PLANNING_SOURCE = (
    "https://erepository.uonbi.ac.ke/server/api/core/bitstreams/"
    "a391e712-280b-408a-b12d-413483cd201f/content"
)
FAMILY_PLANNING_NEEDS = {
    "SYN-C04": 1_174_159,
    "SYN-C05": 280_442,
    "SYN-C06": 2_572_465,
    "SYN-C07": 289_015,
    "SYN-C08": 299_720,
    "SYN-C09": 165_415,
}
PUBLIC_FACILITY_COUNT = 6_304
NATIONAL_PROCUREMENT_KES = 31_138_078_092


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
            # Rounded national turnaround anchors; dispersion is an invented demo assumption.
            "lead_time_days": (24 if level in (2, 3) else 20) + rng.randint(-5, 5),
        }
        for index, level in enumerate(levels, 1)
    ]
    commodities = [
        {"id": f"SYN-C{index:02d}", "name": f"Synthetic commodity {index:02d}"}
        for index in range(1, 11)
    ]
    # National equal-share scaling and level-weighted variation are synthetic assumptions.
    amounts: dict[tuple[str, str, int], int] = {}
    for commodity_id, annual in (MALARIA_NEEDS | FAMILY_PLANNING_NEEDS).items():
        for month in range(24):
            target = (
                annual
                * len(facilities)
                * SEASONAL_INDEX[month % 12]
                // (PUBLIC_FACILITY_COUNT * 12 * 100)
            )
            weights = [facility["level"] * rng.randint(90, 110) for facility in facilities]
            total_weight = sum(weights)
            assigned = [target * weight // total_weight for weight in weights]
            remainder_order = sorted(
                range(len(facilities)), key=lambda i: (-(target * weights[i] % total_weight), i)
            )
            for index in remainder_order[: target - sum(assigned)]:
                assigned[index] += 1
            for facility, quantity in zip(facilities, assigned, strict=True):
                amounts[(facility["id"], commodity_id, month)] = quantity
    consumption = []
    for facility in facilities:
        for commodity in commodities:
            for month in range(24):
                consumption.append(
                    {
                        "facility_id": facility["id"],
                        "commodity_id": commodity["id"],
                        "month_index": month,
                        "quantity": amounts[(facility["id"], commodity["id"], month)],
                    }
                )
    # Annual national procurement value supplies a scale only; it is not an approved budget.
    panel_total = NATIONAL_PROCUREMENT_KES * len(facilities) // PUBLIC_FACILITY_COUNT
    budget_weights = [rng.randint(1, 100) for _ in commodities]
    total_budget_weight = sum(budget_weights)
    budgets = [panel_total * weight // total_budget_weight for weight in budget_weights]
    budget_order = sorted(
        range(len(commodities)),
        key=lambda i: (-(panel_total * budget_weights[i] % total_budget_weight), i),
    )
    for index in budget_order[: panel_total - sum(budgets)]:
        budgets[index] += 1
    budget_lines: list[BudgetLine] = [
        {"id": f"SYN-B{index:02d}", "commodity_id": item["id"], "approved": amount}
        for index, (item, amount) in enumerate(zip(commodities, budgets, strict=True), 1)
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
        "calibration_scope": "facility mix, turnaround, tracer demand, and funding scale proxies; "
        "funding stages and temporal patterns are illustrative assumptions",
        "calibration": {
            "delivery_lead_time": {
                "primary_facility_days": 24.2,
                "hospital_days": 19.5,
                "period": "2024/25",
                "source_url": TURNAROUND_SOURCE,
                "dispersion": "synthetic assumption; not measured by source",
            },
            "malaria_tracers": {
                "period": "2023 projected",
                "source_url": MALARIA_SOURCE,
                "national_need": MALARIA_NEEDS,
                "units": {
                    "SYN-C01": "ACT treatment courses",
                    "SYN-C02": "malaria rapid diagnostic tests",
                    "SYN-C03": "injectable artesunate vials",
                    "SYN-C10": "sulfadoxine-pyrimethamine treatment courses",
                },
                "national_facility_denominator": PUBLIC_FACILITY_COUNT,
                "scope": "synthetic equal-share and level-weighted proxy, not observed use",
            },
            "family_planning_tracers": {
                "period": "2014–2017 historical mean",
                "source_url": FAMILY_PLANNING_SOURCE,
                "national_mean": FAMILY_PLANNING_NEEDS,
                "units": {
                    "SYN-C04": "combined oral contraceptive cycles",
                    "SYN-C05": "progestin-only pill cycles",
                    "SYN-C06": "injectable contraceptive vials",
                    "SYN-C07": "intrauterine contraceptive devices",
                    "SYN-C08": "one-rod implants",
                    "SYN-C09": "two-rod implants",
                },
                "national_facility_denominator": PUBLIC_FACILITY_COUNT,
                "scope": "synthetic equal-share and level-weighted proxy, "
                "not facility observations",
            },
            "funding_scale": {
                "period": "2024/25",
                "source_url": TURNAROUND_SOURCE,
                "national_procurement_kes": NATIONAL_PROCUREMENT_KES,
                "national_facility_denominator": PUBLIC_FACILITY_COUNT,
                "scope": "procurement value is only a synthetic approved-budget scale proxy; "
                "line allocations and cash-flow stages are assumptions",
            },
        },
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
