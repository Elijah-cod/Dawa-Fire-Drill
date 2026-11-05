import pytest

from dawa_api.forecasting.service import backtest


def test_rolling_backtest_uses_only_previous_synthetic_periods():
    steps = backtest([10, 20, 30, 100], window=2)
    assert [(step.period, step.predicted, step.observed) for step in steps] == [
        (2, 15, 30),
        (3, 25, 100),
    ]


def test_backtest_rejects_invalid_histories():
    with pytest.raises(ValueError):
        backtest([1, 2], window=2)
    with pytest.raises(ValueError):
        backtest([1, -1, 2], window=1)


def test_backtest_on_generated_synthetic_consumption():
    from dawa_api.ingestion.synthetic import generate_dataset

    dataset = generate_dataset(seed=42)
    first = dataset["consumption"][0]
    history = [
        item["quantity"]
        for item in dataset["consumption"]
        if item["facility_id"] == first["facility_id"]
        and item["commodity_id"] == first["commodity_id"]
    ]
    assert dataset["synthetic"] is True
    assert len(backtest(history, window=3)) == 21
