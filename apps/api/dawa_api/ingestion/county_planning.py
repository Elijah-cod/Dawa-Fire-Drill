"""Synthetic planning-only county figures anchored to public national totals."""

import random
from collections.abc import Iterable, Mapping
from typing import Any, Literal, TypedDict

from dawa_api.countries.ke.counties import KENYA_COUNTIES

REPORT_URL = "https://www.busiacounty.go.ke/assets/documents/uploads/CGBIRR%20August%202025.pdf"
TOTAL_APPROVED = 601_690_000_000
TOTAL_RELEASED = 469_340_000_000


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
    """Generate unrelated-to-real-county shares of two national all-sector totals."""
    # Reproducible synthetic data does not need cryptographic randomness.
    rng = random.Random(seed)  # nosec B311
    approved = _allocate(TOTAL_APPROVED, [rng.randint(50, 150) for _ in KENYA_COUNTIES])
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
            "scope": "national all-sector totals; county allocation is invented",
        },
        "counties": counties,
    }
