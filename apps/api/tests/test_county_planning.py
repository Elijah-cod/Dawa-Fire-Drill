from hypothesis import given
from hypothesis import strategies as st

from dawa_api.ingestion.county_planning import generate_county_planning, roll_up


def test_county_planning_seed_is_complete_and_reproducible() -> None:
    first = generate_county_planning(seed=42)
    assert first == generate_county_planning(seed=42)
    assert first != generate_county_planning(seed=43)
    assert len(first["counties"]) == 47
    assert len({row["county_code"] for row in first["counties"]}) == 47
    assert all(row["synthetic"] is True for row in first["counties"])
    assert first["calibration"]["source_url"].startswith("https://www.busiacounty.go.ke/")
    totals = roll_up(first["counties"])
    assert totals["approved"] == 601_690_000_000
    assert totals["released"] == 469_340_000_000
    assert all(0 <= row["released"] <= row["approved"] for row in first["counties"])


@given(seed=st.integers(min_value=0, max_value=2**31 - 1))
def test_county_allocations_preserve_totals_and_never_overrelease(seed: int) -> None:
    records = generate_county_planning(seed=seed)["counties"]
    assert roll_up(records) == {"approved": 601_690_000_000, "released": 469_340_000_000}
    assert all(0 <= row["released"] <= row["approved"] for row in records)


@given(
    values=st.lists(st.tuples(st.integers(0, 1_000_000), st.integers(0, 1_000_000)), max_size=47)
)
def test_rollup_equals_sum_of_parts(values: list[tuple[int, int]]) -> None:
    rows = [{"approved": approved, "released": released} for approved, released in values]
    assert roll_up(rows) == {
        "approved": sum(row[0] for row in values),
        "released": sum(row[1] for row in values),
    }
