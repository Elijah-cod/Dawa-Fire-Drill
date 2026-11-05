"""Illustrative, unvalidated stock-flow model for synthetic inputs."""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class SimulationResult:
    closing_stock: int
    stockout_day: int | None


def simulate_stock(
    *, opening_stock: int, daily_demand: int, days: int, deliveries: Mapping[int, int]
) -> SimulationResult:
    """Apply deliveries before daily demand; day numbers start at one."""
    if opening_stock < 0 or daily_demand < 0 or days < 1:
        raise ValueError("Stock and demand must be nonnegative and days must be positive")
    if any(day < 1 or day > days or amount < 0 for day, amount in deliveries.items()):
        raise ValueError("Deliveries require nonnegative quantities on days within the run")
    stock = opening_stock
    stockout_day = None
    cursor = 1
    for day, quantity in [*sorted(deliveries.items()), (days + 1, 0)]:
        span = day - cursor
        if span and daily_demand:
            days_to_empty = max(1, (stock + daily_demand - 1) // daily_demand)
            if stockout_day is None and days_to_empty <= span:
                stockout_day = cursor + days_to_empty - 1
            stock = max(0, stock - daily_demand * span)
        stock += quantity
        cursor = day
    return SimulationResult(closing_stock=stock, stockout_day=stockout_day)
