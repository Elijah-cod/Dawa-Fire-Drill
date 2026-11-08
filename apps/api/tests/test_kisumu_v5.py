"""Version 5 spreads synthetic stock cover so shock-caused stockouts have a meaningful order."""

from collections import Counter

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from dawa_api.ingestion.county_repository import COUNTY_GENERATOR_VERSION
from dawa_api.ingestion.kisumu import generate_kisumu_panel
from dawa_api.optimization.kisumu import rank_kisumu
from dawa_api.optimization.modeled_schemas import ModeledRequest
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.kisumu import simulate_kisumu


def shock(magnitude: int) -> ScenarioCreate:
    return ScenarioCreate(
        name="Synthetic donor shock", shock_type="logistics_reduction", magnitude=magnitude
    )


def test_v5_is_served_and_v4_stays_unchanged() -> None:
    assert COUNTY_GENERATOR_VERSION == 5
    old = simulate_kisumu(shock(40), generate_kisumu_panel(seed=42, version=4), horizon_days=90)
    first = old["shock_caused_stockouts"][0]
    assert (first["facility_id"], first["commodity_id"], first["day"]) == (
        "SYN-KE-042-F001",
        "SYN-C02",
        48,
    )
    assert "transfer_routes" not in generate_kisumu_panel(seed=42, version=4)["demo_cases"]


@pytest.mark.parametrize("magnitude", [40, 41])
def test_v5_shock_stockouts_spread_over_several_weeks(magnitude: int) -> None:
    data = generate_kisumu_panel(seed=42, version=5)
    assert data == generate_kisumu_panel(seed=42, version=5)
    days = [
        item["day"]
        for item in simulate_kisumu(shock(magnitude), data, horizon_days=90)[
            "shock_caused_stockouts"
        ]
    ]
    assert days == sorted(days)
    assert days[-1] - days[0] >= 28
    assert len({day // 7 for day in days}) >= 5
    assert max(Counter(days).values()) <= 0.15 * len(days)


def test_v5_keeps_planted_cases_and_no_shock_events_at_zero() -> None:
    data = generate_kisumu_panel(seed=42, version=5)
    stock = {(s["facility_id"], s["commodity_id"]): s["opening_stock"] for s in data["stock"]}
    assert stock[("SYN-KE-042-F001", "SYN-C01")] == 0
    assert stock[("SYN-KE-042-F003", "SYN-C01")] == 10
    baseline = simulate_kisumu(shock(0), data, horizon_days=90)
    assert baseline["shock_caused_stockouts"] == []
    assert baseline["pre_shock_stockouts"][0]["facility_id"] == "SYN-KE-042-F001"
    assert data["demo_cases"]["stalled_release"]["released"] == 0
    assert data["demo_cases"]["chronic_stockout"]["commodity_id"] == "SYN-C01"


def test_v5_planted_transfer_targets_the_first_shock_event_and_is_ranked() -> None:
    data = generate_kisumu_panel(seed=42, version=5)
    run = simulate_kisumu(shock(40), data, horizon_days=90)
    first = run["shock_caused_stockouts"][0]
    route = data["demo_cases"]["near_expiry_transfer"]
    assert data["demo_cases"]["transfer_routes"][0] == route
    assert (route["facility_id"], route["commodity_id"]) == (
        first["facility_id"],
        first["commodity_id"],
    )
    assert route["dispatch_day"] < route["arrival_day"] <= first["day"]
    assert route["distance_km"] <= route["maximum_distance_km"]
    assert route["expiry_day"] > route["arrival_day"] + route["minimum_shelf_days"]
    request = ModeledRequest.model_validate(
        {
            "synthetic_attested": True,
            "budget": 100,
            "minimum_benefit": 1,
            "candidates": [
                {
                    "id": "transfer",
                    "kind": "redistribution",
                    "cost": 10,
                    "facility_id": route["facility_id"],
                    "donor_facility_id": route["donor_facility_id"],
                    "commodity_id": route["commodity_id"],
                    "quantity": route["quantity"],
                    "available_units": route["available_units"],
                    "dispatch_day": route["dispatch_day"],
                    "arrival_day": route["arrival_day"],
                    "expiry_day": route["expiry_day"],
                    "minimum_shelf_days": route["minimum_shelf_days"],
                    "distance_km": route["distance_km"],
                    "max_distance_km": route["maximum_distance_km"],
                },
                {
                    "id": "emergency",
                    "kind": "emergency_procurement",
                    "cost": 50,
                    "facility_id": route["facility_id"],
                    "commodity_id": route["commodity_id"],
                    "quantity": route["quantity"],
                    "arrival_day": route["arrival_day"],
                },
            ],
        }
    )
    ranked, effects = rank_kisumu(shock(40), data, run, request=request, horizon_days=90)
    assert ranked.selected_ids == ("transfer",)
    assert ranked.excluded_reasons == {"emergency": "alternative_selected"}
    assert effects[0].deferred_days >= 1


@given(seed=st.integers(min_value=0, max_value=2**31 - 1))
@settings(max_examples=10, deadline=None)
def test_v5_is_reproducible_and_plants_the_first_event_for_any_seed(seed: int) -> None:
    data = generate_kisumu_panel(seed=seed, version=5)
    assert data == generate_kisumu_panel(seed=seed, version=5)
    first = simulate_kisumu(shock(40), data, horizon_days=90)["shock_caused_stockouts"][0]
    route = data["demo_cases"]["near_expiry_transfer"]
    assert (route["facility_id"], route["commodity_id"]) == (
        first["facility_id"],
        first["commodity_id"],
    )


@given(seed=st.integers(min_value=0, max_value=2**31 - 1))
@settings(max_examples=20, deadline=None)
def test_v5_points_stay_in_their_land_checked_boxes_and_routes_match(seed: int) -> None:
    from math import asin, cos, radians, sin, sqrt

    from dawa_api.ingestion.kisumu import V5_CENTERS

    data = generate_kisumu_panel(seed=seed, version=5)
    facilities = {f["id"]: f for f in data["facilities"]}
    for index, facility in enumerate(data["facilities"]):
        lat, lon = V5_CENTERS[index % len(V5_CENTERS)]
        assert abs(facility["latitude"] - lat) <= 0.003 + 1e-9
        assert abs(facility["longitude"] - lon) <= 0.003 + 1e-9
        assert facility["coordinates_synthetic"] is True
    assert len({(f["latitude"], f["longitude"]) for f in facilities.values()}) == 40

    def km(a: dict, b: dict) -> float:
        lat1, lon1, lat2, lon2 = map(
            radians, (a["latitude"], a["longitude"], b["latitude"], b["longitude"])
        )
        arc = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
        return 2 * 6371 * asin(sqrt(arc))

    routes = data["demo_cases"]["transfer_routes"]
    assert [(d["source"], d["target"], d["distance_km"]) for d in data["distances"]] == [
        (r["donor_facility_id"], r["facility_id"], r["distance_km"]) for r in routes
    ]
    for route in routes:
        donor, recipient = facilities[route["donor_facility_id"]], facilities[route["facility_id"]]
        assert abs(km(donor, recipient) - route["distance_km"]) < 1
        assert 0 < route["distance_km"] <= route["maximum_distance_km"]
        assert donor["subcounty_id"] != recipient["subcounty_id"]


def budget_request(routes: list[dict], budget: int) -> ModeledRequest:
    candidates: list[dict] = []
    for index, route in enumerate(routes, 1):
        candidates.append(
            {
                "id": f"transfer-{index}",
                "kind": "redistribution",
                "cost": 10,
                "facility_id": route["facility_id"],
                "donor_facility_id": route["donor_facility_id"],
                "commodity_id": route["commodity_id"],
                "quantity": route["quantity"],
                "available_units": route["available_units"],
                "dispatch_day": route["dispatch_day"],
                "arrival_day": route["arrival_day"],
                "expiry_day": route["expiry_day"],
                "minimum_shelf_days": route["minimum_shelf_days"],
                "distance_km": route["distance_km"],
                "max_distance_km": route["maximum_distance_km"],
            }
        )
        candidates.append(
            {
                "id": f"emergency-{index}",
                "kind": "emergency_procurement",
                "cost": 50,
                "facility_id": route["facility_id"],
                "commodity_id": route["commodity_id"],
                "quantity": route["quantity"],
                "arrival_day": route["arrival_day"],
            }
        )
    return ModeledRequest.model_validate(
        {"synthetic_attested": True, "budget": budget, "candidates": candidates}
    )


def test_v5_plants_routes_for_the_four_earliest_shock_events() -> None:
    data = generate_kisumu_panel(seed=42, version=5)
    events = simulate_kisumu(shock(40), data, horizon_days=90)["shock_caused_stockouts"]
    routes = data["demo_cases"]["transfer_routes"]
    assert [(r["facility_id"], r["commodity_id"]) for r in routes] == [
        (e["facility_id"], e["commodity_id"]) for e in events[:4]
    ]
    assert len({(r["donor_facility_id"], r["commodity_id"]) for r in routes}) == 4
    for route, event in zip(routes, events, strict=False):
        assert route["dispatch_day"] < route["arrival_day"] <= event["day"]


def test_v5_budget_funds_some_fixes_and_names_the_budget_for_the_rest() -> None:
    data = generate_kisumu_panel(seed=42, version=5)
    run = simulate_kisumu(shock(40), data, horizon_days=90)
    routes = data["demo_cases"]["transfer_routes"]

    full, effects = rank_kisumu(
        shock(40), data, run, request=budget_request(routes, 100), horizon_days=90
    )
    assert sorted(full.selected_ids) == ["transfer-1", "transfer-2", "transfer-3", "transfer-4"]
    assert full.total_cost == 40
    assert all(
        full.excluded_reasons[f"emergency-{i}"] == "alternative_selected" for i in range(1, 5)
    )
    assert all(effect.deferred_days >= 1 for effect in effects)

    partial, _ = rank_kisumu(
        shock(40), data, run, request=budget_request(routes, 30), horizon_days=90
    )
    assert len(partial.selected_ids) == 3 and partial.total_cost == 30
    (cut,) = {f"transfer-{i}" for i in range(1, 5)} - set(partial.selected_ids)
    assert partial.excluded_reasons[cut] == "remaining_budget_exceeded"
    assert all(
        partial.excluded_reasons[f"emergency-{i}"] == "cost_exceeds_ceiling" for i in range(1, 5)
    )

    none, _ = rank_kisumu(shock(40), data, run, request=budget_request(routes, 5), horizon_days=90)
    assert none.selected_ids == () and none.total_cost == 0
    assert set(none.excluded_reasons.values()) == {"cost_exceeds_ceiling"}


def test_v5_rejects_a_transfer_that_matches_no_planted_route() -> None:
    data = generate_kisumu_panel(seed=42, version=5)
    run = simulate_kisumu(shock(40), data, horizon_days=90)
    route = {**data["demo_cases"]["transfer_routes"][0], "distance_km": 1}
    with pytest.raises(ValueError, match="pinned synthetic route"):
        rank_kisumu(shock(40), data, run, request=budget_request([route], 100), horizon_days=90)
