from hypothesis import given
from hypothesis import strategies as st

from dawa_api.simulation.service import simulate_stock


def test_simulation_reports_first_stockout_day() -> None:
    result = simulate_stock(opening_stock=10, daily_demand=3, days=5, deliveries={2: 2})
    assert result.stockout_day == 4
    assert result.closing_stock == 0


@given(
    opening=st.integers(min_value=0, max_value=1000),
    demand=st.integers(min_value=0, max_value=100),
    days=st.integers(min_value=1, max_value=100),
)
def test_stock_never_negative_and_run_is_deterministic(
    opening: int, demand: int, days: int
) -> None:
    first = simulate_stock(opening_stock=opening, daily_demand=demand, days=days, deliveries={})
    second = simulate_stock(opening_stock=opening, daily_demand=demand, days=days, deliveries={})
    assert first == second
    assert first.closing_stock >= 0
