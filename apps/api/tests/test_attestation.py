"""Only a literal JSON true can attest synthetic data or human review."""

import pytest
from pydantic import ValidationError

from dawa_api.capture.schemas import CaptureConfirmation
from dawa_api.finance_flow.schemas import FundingTraceRequest
from dawa_api.forecasting.router import ForecastRequest
from dawa_api.optimization.router import RunRankRequest
from dawa_api.redistribution.router import TransferRequest


@pytest.mark.parametrize(
    ("model", "field", "valid"),
    [
        (
            ForecastRequest,
            "synthetic_attested",
            {"history": [1], "lead_time_periods": 1, "safety_periods": 0},
        ),
        (
            FundingTraceRequest,
            "synthetic_attested",
            {
                "approved": 1,
                "released": 0,
                "procured": 0,
                "delivered": 0,
                "approved_on": "2025-01-01",
                "released_on": None,
                "procured_on": None,
                "delivered_on": None,
                "as_of": "2025-01-01",
            },
        ),
        (
            TransferRequest,
            "synthetic_attested",
            {
                "source_id": "a",
                "target_id": "b",
                "available": 1,
                "needed": 1,
                "shelf_life_days": 1,
                "minimum_shelf_life_days": 1,
                "distance_km": 1,
                "max_distance_km": 1,
            },
        ),
        (RunRankRequest, "synthetic_attested", {"budget": 1, "candidates": []}),
        (
            CaptureConfirmation,
            "reviewed",
            {
                "fields": {
                    "commodity_name": "demo",
                    "opening_balance": 1,
                    "closing_balance": 1,
                    "record_date": "2025-01-01",
                }
            },
        ),
    ],
)
def test_explicit_boolean_required(model, field, valid):
    assert getattr(model.model_validate(valid | {field: True}), field) is True
    with pytest.raises(ValidationError):
        model.model_validate(valid | {field: 1})
