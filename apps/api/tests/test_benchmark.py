import pytest

from dawa_api.simulation.benchmark import run_benchmark


def test_benchmark_runs_synthetic_scenario_and_labels_results():
    result = run_benchmark(seed=42, iterations=2)
    assert result["synthetic"] is True
    assert result["iterations"] == 2
    assert result["median_ms"] >= 0 and result["max_ms"] >= result["median_ms"]
    assert "unvalidated" in result["notice"]


def test_benchmark_rejects_unbounded_iterations():
    with pytest.raises(ValueError):
        run_benchmark(seed=42, iterations=0)
    with pytest.raises(ValueError):
        run_benchmark(seed=42, iterations=1001)
