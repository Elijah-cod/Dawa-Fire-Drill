import pytest
from hypothesis import given
from hypothesis import strategies as st

from dawa_api.optimization.service import Candidate, TargetUnreachable, select_actions


def test_optimizer_selects_highest_benefit_within_budget() -> None:
    result = select_actions([Candidate("a", 5, 7), Candidate("b", 4, 6)], budget=5)
    assert result.selected_ids == ("a",)
    assert result.total_cost == 5


def test_equal_benefit_prefers_lower_cost_and_explains_exclusion() -> None:
    result = select_actions([Candidate("expensive", 5, 7), Candidate("cheap", 3, 7)], budget=5)
    assert result.selected_ids == ("cheap",)
    assert result.total_cost == 3
    assert result.excluded_reasons["expensive"] == "not_selected_by_optimal_set"


def test_excluded_action_that_exceeds_budget_has_explicit_reason() -> None:
    result = select_actions([Candidate("too-expensive", 6, 10)], budget=5)
    assert result.selected_ids == ()
    assert result.excluded_reasons["too-expensive"] == "cost_exceeds_ceiling"


def test_selected_actions_are_ranked_by_solver() -> None:
    result = select_actions([Candidate("lower", 1, 2), Candidate("higher", 1, 8)], budget=2)
    assert result.selected_ids == ("higher", "lower")


def test_same_stockout_alternatives_are_not_double_counted() -> None:
    result = select_actions(
        [
            Candidate("emergency", 5, 8, group=("facility", "commodity")),
            Candidate("redistribution", 3, 8, group=("facility", "commodity")),
            Candidate("other", 2, 3, group=("other-facility", "commodity")),
        ],
        budget=10,
    )
    assert result.selected_ids == ("redistribution", "other")
    assert result.total_cost == 5
    assert result.excluded_reasons["emergency"] == "alternative_selected"


def test_target_selects_cheapest_set_meeting_assumed_benefit() -> None:
    result = select_actions(
        [Candidate("expensive", 8, 10), Candidate("cheap", 3, 5), Candidate("extra", 2, 3)],
        budget=10,
        minimum_benefit=5,
    )
    assert result.selected_ids == ("cheap",)
    assert result.total_cost == 3


def test_unreachable_target_respects_budget_and_alternative_groups() -> None:
    with pytest.raises(TargetUnreachable):
        select_actions(
            [Candidate("a", 2, 4, ("f", "c")), Candidate("b", 2, 4, ("f", "c"))],
            budget=5,
            minimum_benefit=8,
        )


@given(budget=st.integers(min_value=0, max_value=100))
def test_optimizer_never_exceeds_ceiling(budget: int) -> None:
    result = select_actions([Candidate("a", 8, 10), Candidate("b", 3, 4)], budget=budget)
    assert result.total_cost <= budget
