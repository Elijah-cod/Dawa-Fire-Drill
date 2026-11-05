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
