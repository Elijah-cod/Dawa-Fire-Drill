"""Synthetic multi-facility redistribution must respect inventory and transport constraints."""

import pytest
from hypothesis import given
from hypothesis import strategies as st

from dawa_api.redistribution.matching import Demand, Lane, Supply, match_transfers


def test_matches_with_stock_distance_and_expiry_constraints():
    result = match_transfers(
        sources=[Supply("source", 10, 30), Supply("expired", 4, 3)],
        targets=[Demand("target-a", 7), Demand("target-b", 7)],
        lanes=[
            Lane("source", "target-a", 1),
            Lane("source", "target-b", 2),
            Lane("expired", "target-a", 1),
            Lane("expired", "target-b", 100),
        ],
        max_distance_km=10,
        minimum_shelf_life_days=14,
    )
    quantities = {(item.source_id, item.target_id): item.quantity for item in result.transfers}
    assert quantities == {("source", "target-a"): 7, ("source", "target-b"): 3}
    assert result.total_quantity == 10
    assert all(item.source_id != "expired" for item in result.transfers)


def test_rejects_duplicate_or_self_matching():
    with pytest.raises(ValueError):
        match_transfers(
            sources=[Supply("same", 1, 20)],
            targets=[Demand("same", 1)],
            lanes=[],
            max_distance_km=10,
            minimum_shelf_life_days=1,
        )
    with pytest.raises(ValueError):
        match_transfers(
            sources=[Supply("a", 1, 20), Supply("a", 2, 20)],
            targets=[],
            lanes=[],
            max_distance_km=10,
            minimum_shelf_life_days=1,
        )


@given(
    available_a=st.integers(min_value=0, max_value=100),
    available_b=st.integers(min_value=0, max_value=100),
    need_a=st.integers(min_value=0, max_value=100),
    need_b=st.integers(min_value=0, max_value=100),
)
def test_matching_never_exceeds_any_stock_or_need(available_a, available_b, need_a, need_b):
    sources = [Supply("a", available_a, 30), Supply("b", available_b, 30)]
    targets = [Demand("x", need_a), Demand("y", need_b)]
    lanes = [
        Lane(source.facility_id, target.facility_id, 1) for source in sources for target in targets
    ]
    result = match_transfers(
        sources=sources, targets=targets, lanes=lanes, max_distance_km=5, minimum_shelf_life_days=14
    )
    for source in sources:
        assert (
            sum(t.quantity for t in result.transfers if t.source_id == source.facility_id)
            <= source.available
        )
    for target in targets:
        assert (
            sum(t.quantity for t in result.transfers if t.target_id == target.facility_id)
            <= target.needed
        )
    assert result.total_quantity == sum(t.quantity for t in result.transfers)
