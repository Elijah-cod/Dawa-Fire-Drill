"""OR-Tools matching of synthetic inventory under transport and expiry limits."""

import math
from collections.abc import Sequence
from dataclasses import dataclass

from ortools.sat.python import cp_model

from dawa_api.optimization.service import SOLVER_TIME_LIMIT_SECONDS


@dataclass(frozen=True)
class Supply:
    facility_id: str
    available: int
    shelf_life_days: int


@dataclass(frozen=True)
class Demand:
    facility_id: str
    needed: int


@dataclass(frozen=True)
class Lane:
    source_id: str
    target_id: str
    distance_km: float


@dataclass(frozen=True)
class Transfer:
    source_id: str
    target_id: str
    quantity: int
    distance_km: float


@dataclass(frozen=True)
class MatchResult:
    transfers: tuple[Transfer, ...]
    total_quantity: int


def match_transfers(
    *,
    sources: Sequence[Supply],
    targets: Sequence[Demand],
    lanes: Sequence[Lane],
    max_distance_km: float,
    minimum_shelf_life_days: int,
) -> MatchResult:
    if len(sources) > 20 or len(targets) > 20 or len(lanes) > 400:
        raise ValueError("Too many facilities or lanes")
    source_map = {item.facility_id: item for item in sources}
    target_map = {item.facility_id: item for item in targets}
    if len(source_map) != len(sources) or len(target_map) != len(targets):
        raise ValueError("Facility identifiers must be unique")
    if source_map.keys() & target_map.keys():
        raise ValueError("A facility cannot be both a source and a target")
    if (
        not math.isfinite(max_distance_km)
        or not 0 <= max_distance_km <= 10000
        or not 0 <= minimum_shelf_life_days <= 36500
    ):
        raise ValueError("Invalid transport or shelf-life limit")
    if any(
        not 0 <= x.available <= 1_000_000_000 or not 0 <= x.shelf_life_days <= 36500
        for x in sources
    ):
        raise ValueError("Invalid source stock")
    if any(not 0 <= x.needed <= 1_000_000_000 for x in targets):
        raise ValueError("Invalid target need")
    pairs = [(x.source_id, x.target_id) for x in lanes]
    if len(set(pairs)) != len(pairs):
        raise ValueError("Each source-target lane must be unique")
    if any(
        x.source_id not in source_map
        or x.target_id not in target_map
        or not math.isfinite(x.distance_km)
        or not 0 <= x.distance_km <= 10000
        for x in lanes
    ):
        raise ValueError("Lane refers to an unknown facility or invalid distance")
    eligible = sorted(
        (
            x
            for x in lanes
            if x.distance_km <= max_distance_km
            and source_map[x.source_id].shelf_life_days >= minimum_shelf_life_days
        ),
        key=lambda x: (x.source_id, x.target_id),
    )
    if not eligible:
        return MatchResult((), 0)
    model = cp_model.CpModel()
    quantities = [
        model.new_int_var(
            0, min(source_map[x.source_id].available, target_map[x.target_id].needed), f"lane_{i}"
        )
        for i, x in enumerate(eligible)
    ]
    for source in sources:
        model.add(
            sum(
                q
                for q, lane in zip(quantities, eligible, strict=True)
                if lane.source_id == source.facility_id
            )
            <= source.available
        )
    for target in targets:
        model.add(
            sum(
                q
                for q, lane in zip(quantities, eligible, strict=True)
                if lane.target_id == target.facility_id
            )
            <= target.needed
        )
    total = sum(quantities)
    model.maximize(total)
    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    solver.parameters.max_time_in_seconds = SOLVER_TIME_LIMIT_SECONDS
    if solver.solve(model) != cp_model.OPTIMAL:
        raise RuntimeError("Redistribution solver could not prove maximum quantity")
    model.add(total == solver.value(total))
    model.minimize(
        sum(
            q * round(lane.distance_km * 1000) for q, lane in zip(quantities, eligible, strict=True)
        )
    )
    if solver.solve(model) != cp_model.OPTIMAL:
        raise RuntimeError("Redistribution solver could not prove minimum distance")
    transfers = tuple(
        Transfer(lane.source_id, lane.target_id, solver.value(quantity), lane.distance_km)
        for lane, quantity in zip(eligible, quantities, strict=True)
        if solver.value(quantity) > 0
    )
    return MatchResult(transfers, sum(item.quantity for item in transfers))
