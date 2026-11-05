from hypothesis import given
from hypothesis import strategies as st

from dawa_api.optimization.service import Candidate, select_actions


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


@given(budget=st.integers(min_value=0, max_value=100))
def test_optimizer_never_exceeds_ceiling(budget: int) -> None:
    result = select_actions([Candidate("a", 8, 10), Candidate("b", 3, 4)], budget=budget)
    assert result.total_cost <= budget
