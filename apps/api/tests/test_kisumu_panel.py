from dawa_api.ingestion.kisumu import generate_kisumu_panel


def test_kisumu_panel_is_deterministic_and_has_only_kisumu_facilities() -> None:
    data = generate_kisumu_panel(seed=42)
    assert data == generate_kisumu_panel(seed=42)
    assert data != generate_kisumu_panel(seed=43)
    assert data["synthetic"] is True
    assert data["county_code"] == "042"
    assert len(data["subcounties"]) == 7
    assert len(data["facilities"]) == 40
    assert all(facility["county_code"] == "042" for facility in data["facilities"])
    assert {c["category"] for c in data["commodities"]} >= {"antiretroviral", "antimalarial"}
    assert len(data["commodities"]) == 10


def test_planted_kisumu_cases_have_consistent_synthetic_records() -> None:
    data = generate_kisumu_panel(seed=42)
    demo = data["demo_cases"]
    assert demo["chronic_stockout"]["facility_id"] in {f["id"] for f in data["facilities"]}
    transfer = demo["near_expiry_transfer"]
    assert transfer["distance_km"] <= transfer["maximum_distance_km"]
    assert transfer["expiry_day"] > transfer["arrival_day"] + transfer["minimum_shelf_days"]
    assert transfer["available_units"] >= transfer["quantity"] > 0
    assert demo["stalled_release"]["approved"] > 0
    assert demo["stalled_release"]["released"] == 0
