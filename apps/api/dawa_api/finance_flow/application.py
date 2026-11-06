"""Coordinate funding trace validation and presentation."""

from datetime import date
from typing import Any

from dawa_api.finance_flow.schemas import BottleneckRead, FundingTraceRequest, FundingTraceResponse
from dawa_api.finance_flow.trace import FundingTranche, trace_funding


def trace_request(data: FundingTraceRequest) -> FundingTraceResponse:
    findings = trace_funding(
        FundingTranche(**data.model_dump(exclude={"as_of", "synthetic_attested"})), as_of=data.as_of
    )
    return FundingTraceResponse(
        bottlenecks=[
            BottleneckRead(stage=x.stage, amount=x.amount, age_days=x.age_days) for x in findings
        ]
    )


def trace_kisumu_case(
    snapshot: dict[str, Any], *, flow_id: str, as_of: date
) -> FundingTraceResponse:
    if snapshot.get("synthetic") is not True or snapshot.get("county_code") != "042":
        raise ValueError("Synthetic Kisumu snapshot required")
    case = snapshot["demo_cases"]["stalled_release"]
    if case["id"] != flow_id:
        raise LookupError("Synthetic funding flow not found")
    request = FundingTraceRequest.model_validate(
        {
            "synthetic_attested": True,
            "approved": case["approved"],
            "released": case["released"],
            "procured": 0,
            "delivered": 0,
            "approved_on": case["approved_on"],
            "released_on": None,
            "procured_on": None,
            "delivered_on": None,
            "as_of": as_of,
        }
    )
    return trace_request(request)
