"""Synthetic planning-only county figures anchored to public national totals."""

import random
from collections.abc import Iterable, Mapping
from typing import Any, Literal, TypedDict

from dawa_api.countries.ke.counties import KENYA_COUNTIES

REPORT_URL = "https://www.busiacounty.go.ke/assets/documents/uploads/CGBIRR%20August%202025.pdf"
TOTAL_APPROVED = 601_690_000_000
TOTAL_RELEASED = 469_340_000_000
# Controller of Budget table 2.5, county budget totals in 0.01 million KSh,
# ordered by official county code. These public aggregates are calibration inputs.
COUNTY_BUDGET_WEIGHTS = (
    1736000,
    1487606,
    2140650,
    917772,
    498865,
    817970,
    1200581,
    1351762,
    1456755,
    1031861,
    680505,
    1310895,
    700568,
    853354,
    1430536,
    1562216,
    1158021,
    877976,
    900403,
    792571,
    1074365,
    2348038,
    1721359,
    810151,
    738222,
    1045502,
    1517979,
    789987,
    1018822,
    898376,
    847954,
    2398040,
    1756752,
    1278647,
    975694,
    983170,
    1764679,
    710590,
    1670446,
    1077015,
    1094813,
    1531433,
    1313057,
    1214701,
    1515535,
    810290,
    4356427,
)


class CountyPlanning(TypedDict):
    synthetic: Literal[True]
    country_code: str
    county_code: str
    county_name: str
    approved: int
    released: int


def _allocate(total: int, weights: list[int]) -> list[int]:
    denominator = sum(weights)
    shares = [total * weight // denominator for weight in weights]
    order = sorted(range(len(weights)), key=lambda i: (-(total * weights[i] % denominator), i))
    for index in order[: total - sum(shares)]:
        shares[index] += 1
    return shares


def roll_up(rows: Iterable[Mapping[str, Any]]) -> dict[str, int]:
    """Sum synthetic planning records, without interpreting them as health budgets."""
    approved = released = 0
    for row in rows:
        approved += int(row["approved"])
        released += int(row["released"])
    return {"approved": approved, "released": released}


def generate_county_planning(*, seed: int) -> dict[str, Any]:
    """Generate synthetic county budgets and release shares from public anchors."""
    # Reproducible synthetic data does not need cryptographic randomness.
    rng = random.Random(seed)  # nosec B311
    approved = _allocate(
        TOTAL_APPROVED, [weight * rng.randint(95, 105) for weight in COUNTY_BUDGET_WEIGHTS]
    )
    released = _allocate(TOTAL_RELEASED, [budget * rng.randint(90, 110) for budget in approved])
    counties: list[CountyPlanning] = [
        {
            "synthetic": True,
            "country_code": "KE",
            "county_code": county.code,
            "county_name": county.name,
            "approved": budget,
            "released": cash,
        }
        for county, budget, cash in zip(KENYA_COUNTIES, approved, released, strict=True)
    ]
    return {
        "synthetic": True,
        "notice": "Illustrative synthetic all-sector proxies, not real county or health budgets",
        "seed": seed,
        "calibration": {
            "period": "2024/25",
            "source_url": REPORT_URL,
            "approved_total_kes": TOTAL_APPROVED,
            "released_to_operational_accounts_total_kes": TOTAL_RELEASED,
            "scope": "all-sector county budgets with synthetic variation; "
            "county release shares are invented",
        },
        "counties": counties,
    }
