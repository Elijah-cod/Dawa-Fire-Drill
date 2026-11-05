"""Deterministic fallback explanation derived solely from solver results."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal, Protocol

import httpx
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import SQLAlchemyError

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


class ExplanationProvider(Protocol):
    async def explain(self, payload: dict[str, Any]) -> str: ...


class CallBudget(Protocol):
    async def reserve(self) -> bool: ...


class ExplanationStyle(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text: Literal[
        "The chosen option fits the budget.",
        "The selected set fits the supplied budget.",
        "The solver chose a set under the budget.",
    ]


async def explain_with_providers(
    result: OptimizationResult,
    *,
    budget: int,
    providers: Sequence[ExplanationProvider],
    store: CallBudget,
) -> Explanation:
    """Permit only reviewed prose choices; the solver result remains authoritative."""
    fallback = explain_selection(result, budget=budget)
    if not result.selected_ids:
        return fallback
    payload = {
        "selected_ids": list(result.selected_ids),
        "excluded_reasons": result.excluded_reasons,
        "total_cost": result.total_cost,
        "budget": budget,
    }
    for provider in providers:
        try:
            allowed = await store.reserve()
        except SQLAlchemyError:
            break
        if not allowed:
            break
        try:
            style = ExplanationStyle.model_validate_json(await provider.explain(payload))
            return Explanation(result.selected_ids, fallback.text + " " + style.text)
        except (httpx.HTTPError, ValueError, KeyError, TypeError, RuntimeError):
            continue
    return fallback
