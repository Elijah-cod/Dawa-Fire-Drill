"""Illustrative optimization over synthetic candidate inputs."""

from collections.abc import Sequence
from dataclasses import dataclass

from ortools.sat.python import cp_model


@dataclass(frozen=True)
class Candidate:
    id: str
    cost: int
    benefit: int


@dataclass(frozen=True)
class OptimizationResult:
    selected_ids: tuple[str, ...]
    total_cost: int


def select_actions(candidates: Sequence[Candidate], *, budget: int) -> OptimizationResult:
    """Select the greatest synthetic benefit without exceeding the ceiling."""
    if budget < 0 or any(c.cost < 0 or c.benefit < 0 for c in candidates):
        raise ValueError("Budget, costs, and benefits must be nonnegative")
    if len({c.id for c in candidates}) != len(candidates):
        raise ValueError("Candidate IDs must be unique")
    model = cp_model.CpModel()
    choices = [model.new_bool_var(f"choice_{index}") for index in range(len(candidates))]
    model.add(sum(c.cost * choice for c, choice in zip(candidates, choices, strict=True)) <= budget)
    model.maximize(sum(c.benefit * choice for c, choice in zip(candidates, choices, strict=True)))
    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    status = solver.solve(model)
    if status != cp_model.OPTIMAL:
        raise RuntimeError("Optimizer did not prove an optimal selection")
    selected = [c for c, choice in zip(candidates, choices, strict=True) if solver.value(choice)]
    return OptimizationResult(tuple(c.id for c in selected), sum(c.cost for c in selected))
