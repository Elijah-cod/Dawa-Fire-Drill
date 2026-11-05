"""Repeatable local timing smoke test over a synthetic dataset."""

import argparse
import json
import platform
import statistics
from time import perf_counter
from typing import TypedDict

from dawa_api.ingestion.synthetic import generate_dataset
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.scenario import ScenarioResult, simulate_scenario


class BenchmarkResult(TypedDict):
    synthetic: bool
    notice: str
    seed: int
    iterations: int
    median_ms: float
    max_ms: float
    python: str
    architecture: str


def run_benchmark(*, seed: int, iterations: int) -> BenchmarkResult:
    if not 1 <= iterations <= 1000:
        raise ValueError("Iterations must be between 1 and 1000")
    data = generate_dataset(seed=seed)
    scenario = ScenarioCreate(
        name="Synthetic benchmark", shock_type="logistics_reduction", magnitude=40
    )
    times = []
    reference: ScenarioResult | None = None
    for _ in range(iterations):
        start = perf_counter()
        result = simulate_scenario(scenario, seed=seed, horizon_days=90, dataset=data)
        times.append((perf_counter() - start) * 1000)
        if reference is not None and result != reference:
            raise RuntimeError("Synthetic simulation was not deterministic")
        reference = result
    return {
        "synthetic": True,
        "notice": "Synthetic timing only; model outputs are illustrative and unvalidated",
        "seed": seed,
        "iterations": iterations,
        "median_ms": round(statistics.median(times), 3),
        "max_ms": round(max(times), 3),
        "python": platform.python_version(),
        "architecture": platform.machine(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Time a synthetic scenario simulation")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--iterations", type=int, default=20)
    args = parser.parse_args()
    print(json.dumps(run_benchmark(seed=args.seed, iterations=args.iterations)))


if __name__ == "__main__":
    main()
