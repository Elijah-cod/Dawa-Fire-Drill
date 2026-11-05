"""Illustrative optimization over synthetic candidate inputs."""

from collections.abc import Sequence
from dataclasses import dataclass

from ortools.sat.python import cp_model

SOLVER_TIME_LIMIT_SECONDS = 2.0


@dataclass(frozen=True)
class Candidate:
    id: str
    cost: int
    benefit: int
    group: tuple[str, str] | None = None


@dataclass(frozen=True)
class OptimizationResult:
    selected_ids: tuple[str, ...]
    total_cost: int
    excluded_reasons: dict[str, str]


def select_actions(candidates: Sequence[Candidate], *, budget: int) -> OptimizationResult:
    """Select the greatest synthetic benefit without exceeding the ceiling."""
    if budget < 0 or budget > 1_000_000_000 or len(candidates) > 50:
        raise ValueError("Budget or candidate count is outside supported bounds")
    if any(not 0 <= c.cost <= 1_000_000_000 or not 0 <= c.benefit <= 1_000_000 for c in candidates):
        raise ValueError("Costs or benefits are outside supported bounds")
    if len({c.id for c in candidates}) != len(candidates):
        raise ValueError("Candidate IDs must be unique")
    model = cp_model.CpModel()
    choices = [model.new_bool_var(f"choice_{index}") for index in range(len(candidates))]
    total_cost = sum(c.cost * choice for c, choice in zip(candidates, choices, strict=True))
    total_benefit = sum(c.benefit * choice for c, choice in zip(candidates, choices, strict=True))
    model.add(total_cost <= budget)
    groups = {candidate.group for candidate in candidates if candidate.group is not None}
    for group in sorted(groups):
        model.add(
            sum(
                choice
                for candidate, choice in zip(candidates, choices, strict=True)
                if candidate.group == group
            )
            <= 1
        )
    model.maximize(total_benefit)
    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    solver.parameters.max_time_in_seconds = SOLVER_TIME_LIMIT_SECONDS
    if solver.solve(model) != cp_model.OPTIMAL:
        raise RuntimeError("Optimizer did not prove an optimal selection")
    model.add(total_benefit == solver.value(total_benefit))
    model.minimize(total_cost)
    if solver.solve(model) != cp_model.OPTIMAL:
        raise RuntimeError("Optimizer did not prove minimum cost")
    model.add(total_cost == solver.value(total_cost))
    model.minimize(sum(choices))
    if solver.solve(model) != cp_model.OPTIMAL:
        raise RuntimeError("Optimizer did not prove minimum action count")
    selected = [c for c, choice in zip(candidates, choices, strict=True) if solver.value(choice)]
    ranked = _rank_selected(selected)
    selected_ids = {c.id for c in selected}
    selected_groups = {c.group for c in selected if c.group is not None}
    reasons = {
        c.id: (
            "cost_exceeds_ceiling"
            if c.cost > budget
            else "alternative_selected"
            if c.group is not None and c.group in selected_groups
            else "not_selected_by_optimal_set"
        )
        for c in candidates
        if c.id not in selected_ids
    }
    return OptimizationResult(tuple(c.id for c in ranked), sum(c.cost for c in selected), reasons)


def _rank_selected(selected: list[Candidate]) -> list[Candidate]:
    if not selected:
        return []
    model = cp_model.CpModel()
    count = len(selected)
    positions = [[model.new_bool_var(f"rank_{i}_{j}") for j in range(count)] for i in range(count)]
    for row in positions:
        model.add_exactly_one(row)
    for rank in range(count):
        model.add_exactly_one(positions[index][rank] for index in range(count))
    weighted_benefit = sum(
        selected[index].benefit * (count - rank) * positions[index][rank]
        for index in range(count)
        for rank in range(count)
    )
    model.maximize(weighted_benefit)
    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    solver.parameters.max_time_in_seconds = SOLVER_TIME_LIMIT_SECONDS
    if solver.solve(model) != cp_model.OPTIMAL:
        raise RuntimeError("Optimizer did not prove a ranking")
    model.add(weighted_benefit == solver.value(weighted_benefit))
    model.minimize(
        sum(
            index * (count - rank) * positions[index][rank]
            for index in range(count)
            for rank in range(count)
        )
    )
    if solver.solve(model) != cp_model.OPTIMAL:
        raise RuntimeError("Optimizer did not resolve ranking ties")
    return [
        selected[index]
        for rank in range(count)
        for index in range(count)
        if solver.value(positions[index][rank])
    ]
