"""Moving-average baseline; results are illustrative and unvalidated."""

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Forecast:
    average_demand: float
    reorder_point: float


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


def forecast(history: Sequence[int], *, lead_time_periods: int, safety_periods: int) -> Forecast:
    if not history or any(value < 0 for value in history):
        raise ValueError("History must contain nonnegative observations")
    if lead_time_periods < 0 or safety_periods < 0:
        raise ValueError("Periods must be nonnegative")
    average = sum(history) / len(history)
    return Forecast(average, average * (lead_time_periods + safety_periods))
