from dawa_api.ingestion.repository import GENERATOR_VERSION
from dawa_api.ingestion.synthetic import generate_dataset


def test_seed_is_reproducible_and_structurally_complete() -> None:
    first = generate_dataset(seed=42)
    assert first == generate_dataset(seed=42)
    assert first != generate_dataset(seed=43)
    assert first["synthetic"] is True
    assert len(first["facilities"]) == 40
    assert {row["level"] for row in first["facilities"]} == {2, 3, 4, 5}
    assert len(first["commodities"]) == 10
    assert len(first["consumption"]) == 40 * 10 * 24
    assert first["budget_lines"] and first["procurement_orders"] and first["cash_releases"]
    assert all(row["quantity"] >= 0 for row in first["consumption"])


def test_lead_times_use_separate_public_aggregate_anchors_with_provenance() -> None:
    data = generate_dataset(seed=42)
    calibration = data["calibration"]["delivery_lead_time"]
    assert GENERATOR_VERSION == 5
    assert calibration["primary_facility_days"] == 24.2
    assert calibration["hospital_days"] == 19.5
    assert calibration["period"] == "2024/25"
    assert calibration["source_url"].startswith("https://www.treasury.go.ke/")
    for facility in data["facilities"]:
        center = 24 if facility["level"] in (2, 3) else 20
        assert center - 5 <= facility["lead_time_days"] <= center + 5


def test_malaria_tracers_have_scoped_projected_need_anchors() -> None:
    data = generate_dataset(seed=42)
    calibration = data["calibration"]["malaria_tracers"]
    assert calibration["period"] == "2023 projected"
    assert calibration["source_url"].startswith("https://www.pmi.gov/")
    anchors = {
        "SYN-C01": 6_067_513,
        "SYN-C02": 9_649_693,
        "SYN-C03": 1_087_808,
        "SYN-C10": 1_241_175,
    }
    for commodity, annual_national in anchors.items():
        total = sum(
            row["quantity"]
            for row in data["consumption"]
            if row["commodity_id"] == commodity and row["month_index"] < 12
        )
        expected = annual_national * 40 / 6304
        assert abs(total - expected) < expected * 0.15


def test_family_planning_tracers_use_historical_public_sector_aggregate_proxies() -> None:
    data = generate_dataset(seed=42)
    source = data["calibration"]["family_planning_tracers"]
    assert source["period"] == "2014–2017 historical mean"
    assert source["source_url"].startswith("https://erepository.uonbi.ac.ke/")
    anchors = {
        "SYN-C04": 1_174_159,
        "SYN-C05": 280_442,
        "SYN-C06": 2_572_465,
        "SYN-C07": 289_015,
        "SYN-C08": 299_720,
        "SYN-C09": 165_415,
    }
    for commodity, annual in anchors.items():
        total = sum(
            row["quantity"]
            for row in data["consumption"]
            if row["commodity_id"] == commodity and row["month_index"] < 12
        )
        assert abs(total - annual * 40 / 6304) < annual * 40 / 6304 * 0.05


def test_synthetic_funding_scale_has_source_and_preserves_panel_total() -> None:
    data = generate_dataset(seed=42)
    source = data["calibration"]["funding_scale"]
    assert source["national_procurement_kes"] == 31_138_078_092
    assert source["period"] == "2024/25"
    assert source["source_url"].startswith("https://www.treasury.go.ke/")
    assert sum(line["approved"] for line in data["budget_lines"]) == 31_138_078_092 * 40 // 6304
