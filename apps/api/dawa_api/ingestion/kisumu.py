"""Reproducible synthetic Kisumu pilot inputs; no real facility records are used."""

from typing import Any

from dawa_api.countries.ke.counties import KISUMU_SUBCOUNTIES
from dawa_api.ingestion.synthetic import generate_dataset

HIV_CONTEXT = "https://analytics.nsdcc.go.ke/estimates/PROGRESS-REPORT-2024.pdf"
KISUMU_HIV_ESTIMATE_2023 = 135_550


def generate_kisumu_panel(*, seed: int) -> dict[str, Any]:
    """Create one invented panel with explicit planted examples, never actual observations."""
    source = generate_dataset(seed=seed)
    subcounties = [
        {"id": f"SYN-042-S{index:02d}", "country_code": "KE", "county_code": "042", "name": name}
        for index, name in enumerate(KISUMU_SUBCOUNTIES, 1)
    ]
    id_map = {
        facility["id"]: f"SYN-KE-042-F{index:03d}"
        for index, facility in enumerate(source["facilities"], 1)
    }
    facilities = [
        {
            "id": id_map[facility["id"]],
            "synthetic": True,
            "country_code": "KE",
            "county_code": "042",
            "subcounty_id": subcounties[index % len(subcounties)]["id"],
            "name": f"Synthetic facility {index + 1:03d}",
            "level": facility["level"],
            "lead_time_days": facility["lead_time_days"],
        }
        for index, facility in enumerate(source["facilities"])
    ]
    categories = (
        "antimalarial",
        "malaria_diagnostic",
        "antimalarial",
        "family_planning",
        "family_planning",
        "family_planning",
        "family_planning",
        "family_planning",
        "antiretroviral",
        "antimalarial",
    )
    commodities = [
        {
            "id": item["id"],
            "name": f"Synthetic {category} tracer {index:02d}",
            "category": category,
            "synthetic": True,
        }
        for index, (item, category) in enumerate(
            zip(source["commodities"], categories, strict=True), 1
        )
    ]
    facility_levels = {item["id"]: item["level"] for item in facilities}
    level_sum = sum(facility_levels.values())
    # One percent of the cited county-wide estimate is an invented panel scale, not coverage.
    arv_panel_monthly = KISUMU_HIV_ESTIMATE_2023 // 100
    consumption = []
    for item in source["consumption"]:
        facility_id = id_map[item["facility_id"]]
        quantity = item["quantity"]
        if item["commodity_id"] == "SYN-C09":
            quantity = arv_panel_monthly * facility_levels[facility_id] // level_sum
        consumption.append(
            {
                "country_code": "KE",
                "county_code": "042",
                "facility_id": facility_id,
                "commodity_id": item["commodity_id"],
                "month_index": item["month_index"],
                "quantity": quantity,
                "synthetic": True,
            }
        )
    stock = [
        {
            "facility_id": item["facility_id"],
            "commodity_id": item["commodity_id"],
            "opening_stock": item["quantity"],
            "synthetic": True,
        }
        for item in consumption
        if item["month_index"] == 23
    ]
    chronic_id, donor_id, neighbor_id = (f"SYN-KE-042-F{index:03d}" for index in (1, 2, 3))
    for item in stock:
        if item["commodity_id"] == "SYN-C01" and item["facility_id"] == chronic_id:
            item["opening_stock"] = 0
        if item["commodity_id"] == "SYN-C01" and item["facility_id"] == neighbor_id:
            item["opening_stock"] = 10
        if item["commodity_id"] == "SYN-C01" and item["facility_id"] == donor_id:
            item["opening_stock"] = int(item["opening_stock"]) + 600
    chronic = {
        "facility_id": chronic_id,
        "commodity_id": "SYN-C01",
        "stockout_history_months": 6,
        "synthetic": True,
    }
    transfer = {
        "donor_facility_id": donor_id,
        "facility_id": neighbor_id,
        "commodity_id": "SYN-C01",
        "quantity": 100,
        "available_units": 600,
        "dispatch_day": 1,
        "arrival_day": 2,
        "expiry_day": 45,
        "minimum_shelf_days": 7,
        "distance_km": 12,
        "maximum_distance_km": 30,
        "synthetic": True,
    }
    stalled = {
        "id": "SYN-042-FLOW-01",
        "approved": 100_000,
        "released": 0,
        "approved_on": "2025-01-01",
        "as_of": "2025-04-01",
        "synthetic": True,
    }
    return {
        "synthetic": True,
        "country_code": "KE",
        "county_code": "042",
        "seed": seed,
        "notice": "Synthetic Kisumu pilot; illustrative and unvalidated, not real facility data",
        "calibration": {
            "hiv_context_source": HIV_CONTEXT,
            "county_estimated_people_with_hiv_2023": KISUMU_HIV_ESTIMATE_2023,
            "arv_panel_fraction_assumed": "1% of estimate, monthly proxy only",
        },
        "subcounties": subcounties,
        "facilities": facilities,
        "commodities": commodities,
        "consumption": consumption,
        "stock": stock,
        "distances": [
            {"source": donor_id, "target": neighbor_id, "distance_km": 12, "synthetic": True}
        ],
        "demo_cases": {
            "chronic_stockout": chronic,
            "near_expiry_transfer": transfer,
            "stalled_release": stalled,
        },
    }
