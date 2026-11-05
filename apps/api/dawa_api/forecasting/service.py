"""Moving-average baseline; results are illustrative and unvalidated."""

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Forecast:
    average_demand: float
    reorder_point: float
    stockout_period: int | None


@dataclass(frozen=True)
class BacktestStep:
    period: int
    predicted: float
    observed: int


def backtest(history: Sequence[int], *, window: int) -> list[BacktestStep]:
    """Replay a moving average using only observations before each period."""
    if window < 1 or len(history) <= window or any(value < 0 for value in history):
        raise ValueError("Backtest requires nonnegative history longer than its window")
    return [
        BacktestStep(index, sum(history[index - window : index]) / window, history[index])
        for index in range(window, len(history))
    ]


def forecast(
    history: Sequence[int],
    *,
    lead_time_periods: int,
    safety_periods: int,
    stock_on_hand: int | None = None,
) -> Forecast:
    if not history or any(value < 0 for value in history):
        raise ValueError("History must contain nonnegative observations")
    if lead_time_periods < 0 or safety_periods < 0:
        raise ValueError("Periods must be nonnegative")
    if stock_on_hand is not None and stock_on_hand < 0:
        raise ValueError("Stock on hand must be nonnegative")
    average = sum(history) / len(history)
    stockout_period = None
    if stock_on_hand == 0:
        stockout_period = 0
    elif stock_on_hand is not None and sum(history) > 0:
        stockout_period = (stock_on_hand * len(history) + sum(history) - 1) // sum(history)
    return Forecast(average, average * (lead_time_periods + safety_periods), stockout_period)
