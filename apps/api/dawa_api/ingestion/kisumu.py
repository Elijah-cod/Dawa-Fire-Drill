"""Reproducible synthetic Kisumu pilot inputs; no real facility records are used."""

import random
from math import asin, ceil, cos, radians, sin, sqrt
from typing import Any

from dawa_api.countries.ke.counties import KISUMU_SUBCOUNTIES
from dawa_api.ingestion.synthetic import generate_dataset

HIV_CONTEXT = "https://analytics.nsdcc.go.ke/estimates/PROGRESS-REPORT-2024.pdf"
KISUMU_HIV_ESTIMATE_2023 = 135_550


# Version 5 cover: lead time plus this many invented extra days per facility and commodity.
V5_EXTRA_COVER_DAYS = (4, 40)
# Version 5 plants one transfer route for each of this many earliest 40% shock events.
V5_PLANTED_ROUTES = 4
# Version 5 invented cluster centers, moved inland. Every point of each center's jitter box
# (±0.003 degrees) was checked against OpenStreetMap tiles on 2026-11-08: none fell on water.
V5_CENTERS = (
    (-0.075, 34.760),
    (-0.060, 34.850),
    (-0.040, 34.660),
    (-0.150, 35.150),
    (-0.185, 34.940),
    (-0.340, 35.020),
    (-0.090, 34.540),
)


def _distance_km(a: dict[str, Any], b: dict[str, Any]) -> int:
    lat1, lon1, lat2, lon2 = map(
        radians, (a["latitude"], a["longitude"], b["latitude"], b["longitude"])
    )
    arc = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return round(2 * 6371 * asin(sqrt(arc)))


def generate_kisumu_panel(*, seed: int, version: int = 4) -> dict[str, Any]:
    """Create one invented panel with explicit planted examples, never actual observations."""
    if version not in (1, 2, 3, 4, 5):
        raise ValueError("Unsupported county generator version")
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
    if version >= 3:
        # Invented cluster centers, not actual sub-county centroids or facility locations.
        centers = (
            (
                (-0.120, 34.720),
                (-0.100, 34.780),
                (-0.100, 34.888),
                (-0.180, 34.700),
                (-0.200, 34.840),
                (-0.240, 34.930),
                (-0.055, 34.940),
            )
            if version < 5
            else V5_CENTERS
        )
        # Reproducible synthetic points do not need cryptographic randomness.
        rng = random.Random(seed ^ 0x4B4953554D55)  # nosec B311
        pair_jitter = (rng.randint(-300, 300), rng.randint(-300, 300))
        used: set[tuple[float, float]] = set()
        for index, facility in enumerate(facilities):
            center = centers[index % len(centers)]
            while True:
                offsets = (
                    pair_jitter
                    if index in (1, 2)
                    else (rng.randint(-300, 300), rng.randint(-300, 300))
                )
                point = (
                    round(center[0] + offsets[0] / 100000, 5),
                    round(center[1] + offsets[1] / 100000, 5),
                )
                if point not in used:
                    break
                if index in (1, 2):
                    raise RuntimeError("Synthetic route points unexpectedly collide")
            used.add(point)
            facility.update(latitude=point[0], longitude=point[1], coordinates_synthetic=True)
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
    if version >= 4:
        # A new invented batch protects the first 40% shock event. Older snapshots
        # retain their original F002-to-F003 C01 route and input records.
        for item in stock:
            if item["commodity_id"] == "SYN-C02" and item["facility_id"] == donor_id:
                item["opening_stock"] = int(item["opening_stock"]) + 600
        source_point = facilities[1]
        target_point = facilities[0]
        lat1, lon1, lat2, lon2 = map(
            radians,
            (
                source_point["latitude"],
                source_point["longitude"],
                target_point["latitude"],
                target_point["longitude"],
            ),
        )
        arc = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
        distance = round(2 * 6371 * asin(sqrt(arc)))
        transfer.update(
            facility_id=chronic_id,
            commodity_id="SYN-C02",
            dispatch_day=45,
            arrival_day=46,
            expiry_day=90,
            distance_km=distance,
        )
    routes = [transfer]
    if version >= 5:
        routes = _plant_v5(
            seed, facilities, consumption, stock, (chronic_id, donor_id, neighbor_id)
        )
        transfer = routes[0]
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
            {
                "source": route["donor_facility_id"],
                "target": route["facility_id"],
                "distance_km": route["distance_km"],
                "synthetic": True,
            }
            for route in routes
        ],
        "demo_cases": {
            "chronic_stockout": chronic,
            "near_expiry_transfer": transfer,
            "stalled_release": stalled,
            **({"transfer_routes": routes} if version >= 5 else {}),
        },
    }


def _plant_v5(
    seed: int,
    facilities: list[dict[str, Any]],
    consumption: list[dict[str, Any]],
    stock: list[dict[str, Any]],
    planted: tuple[str, str, str],
) -> list[dict[str, Any]]:
    """Vary opening cover, then plant a nearby donor route for each earliest 40% shock event."""
    from dawa_api.scenarios.schemas import ScenarioCreate
    from dawa_api.simulation.kisumu import simulate_kisumu

    chronic_id, donor_id, neighbor_id = planted
    legacy = {(chronic_id, "SYN-C01"), (donor_id, "SYN-C01"), (neighbor_id, "SYN-C01")}
    lead = {item["id"]: item["lead_time_days"] for item in facilities}
    demand = {
        (item["facility_id"], item["commodity_id"]): item["quantity"]
        for item in consumption
        if item["month_index"] == 23
    }
    # Reproducible synthetic cover does not need cryptographic randomness.
    rng = random.Random(seed ^ 0x434F564552)  # nosec B311
    for item in stock:
        key = (item["facility_id"], item["commodity_id"])
        extra = rng.randint(*V5_EXTRA_COVER_DAYS)
        if key not in legacy:
            # opening_stock * 30 is the simulator's opening units; cover = units / daily demand.
            item["opening_stock"] = ceil(demand[key] * (lead[key[0]] + extra) / 30)
    panel = {
        "synthetic": True,
        "country_code": "KE",
        "county_code": "042",
        "facilities": facilities,
        "consumption": consumption,
        "stock": stock,
        "subcounties": [],
        "demo_cases": {},
    }
    scenario = ScenarioCreate(
        name="Synthetic donor shock", shock_type="logistics_reduction", magnitude=40
    )
    first = simulate_kisumu(scenario, panel, horizon_days=90)["shock_caused_stockouts"]
    targets = first[:V5_PLANTED_ROUTES]
    if len(targets) < V5_PLANTED_ROUTES:
        raise RuntimeError("Too few synthetic shock events to plant routes")
    target_pairs = {(item["facility_id"], item["commodity_id"]) for item in targets}
    target_facilities = {item["facility_id"] for item in targets}
    by_id = {item["id"]: item for item in facilities}
    routes = []
    used: set[tuple[str, str]] = set()
    for event in targets:
        recipient = by_id[event["facility_id"]]
        donors = sorted(
            (
                item
                for item in facilities
                # A neighboring sub-county's facility gives a short but nonzero invented route.
                if item["id"] not in target_facilities
                and item["id"] not in planted
                and item["subcounty_id"] != recipient["subcounty_id"]
                and (item["id"], event["commodity_id"]) not in used
                and (item["id"], event["commodity_id"]) not in target_pairs
            ),
            key=lambda item: (_distance_km(item, recipient), item["id"]),
        )
        donor = donors[0]
        used.add((donor["id"], event["commodity_id"]))
        for item in stock:
            if (item["facility_id"], item["commodity_id"]) == (donor["id"], event["commodity_id"]):
                item["opening_stock"] = int(item["opening_stock"]) + 600
        arrival = max(2, event["day"] - 2)
        routes.append(
            {
                "donor_facility_id": donor["id"],
                "facility_id": event["facility_id"],
                "commodity_id": event["commodity_id"],
                "quantity": 100,
                "available_units": 600,
                "dispatch_day": arrival - 1,
                "arrival_day": arrival,
                "expiry_day": arrival + 44,
                "minimum_shelf_days": 7,
                "distance_km": _distance_km(donor, recipient),
                "maximum_distance_km": 30,
                "synthetic": True,
            }
        )
    again = simulate_kisumu(scenario, panel, horizon_days=90)["shock_caused_stockouts"]
    if again[:V5_PLANTED_ROUTES] != targets:
        raise RuntimeError("Planted donor stock changed the earliest synthetic shock events")
    return routes
