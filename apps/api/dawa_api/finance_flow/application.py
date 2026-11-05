"""Coordinate funding trace validation and presentation."""

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
