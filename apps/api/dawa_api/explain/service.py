"""Deterministic fallback explanation derived solely from solver results."""

from dataclasses import dataclass

from dawa_api.optimization.service import OptimizationResult


@dataclass(frozen=True)
class Explanation:
    selected_ids: tuple[str, ...]
    text: str


def explain_selection(result: OptimizationResult, *, budget: int) -> Explanation:
    selected = ", ".join(result.selected_ids) if result.selected_ids else "none"
    excluded = ", ".join(result.excluded_reasons) if result.excluded_reasons else "none"
    text = (
        "Illustrative and unvalidated. OR-Tools selected "
        + selected
        + " under the supplied budget and assumed benefits. Excluded candidates: "
        + excluded
        + ". The selected set's supplied cost is "
        + str(result.total_cost)
        + " and the budget is "
        + str(budget)
        + "."
    )
    return Explanation(selected_ids=result.selected_ids, text=text)
