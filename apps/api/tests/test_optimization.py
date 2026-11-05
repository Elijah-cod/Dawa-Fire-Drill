from hypothesis import given
from hypothesis import strategies as st

from dawa_api.optimization.service import Candidate, select_actions


def test_optimizer_selects_highest_benefit_within_budget() -> None:
    result = select_actions([Candidate("a", 5, 7), Candidate("b", 4, 6)], budget=5)
    assert result.selected_ids == ("a",)
    assert result.total_cost == 5


@given(budget=st.integers(min_value=0, max_value=100))
def test_optimizer_never_exceeds_ceiling(budget: int) -> None:
    result = select_actions([Candidate("a", 8, 10), Candidate("b", 3, 4)], budget=budget)
    assert result.total_cost <= budget
