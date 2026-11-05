"""Stage-specific diagnostics for an illustrative synthetic funding tranche."""

from dataclasses import dataclass
from datetime import date

from dawa_api.finance_flow.service import Bottleneck


@dataclass(frozen=True)
class FundingTranche:
    approved: int
    released: int
    procured: int
    delivered: int
    approved_on: date
    released_on: date | None
    procured_on: date | None
    delivered_on: date | None


def trace_funding(tranche: FundingTranche, *, as_of: date) -> tuple[Bottleneck, ...]:
    values = (tranche.approved, tranche.released, tranche.procured, tranche.delivered)
    dates = (tranche.approved_on, tranche.released_on, tranche.procured_on, tranche.delivered_on)
    if any(value < 0 for value in values) or any(
        a < b for a, b in zip(values, values[1:], strict=False)
    ):
        raise ValueError("Funding stages must be nonnegative and nonincreasing")
    if any(
        (value > 0) != (day is not None) for value, day in zip(values[1:], dates[1:], strict=True)
    ):
        raise ValueError("Each nonzero downstream stage requires a date")
    present = [day for day in dates if day is not None]
    if any(a > b for a, b in zip(present, present[1:], strict=False)) or any(
        day > as_of for day in present
    ):
        raise ValueError("Stage dates must be chronological and not after as_of")
    labels = ("approved_not_released", "released_not_procured", "procured_not_delivered")
    findings = []
    for label, before, after, day in zip(labels, values, values[1:], dates, strict=False):
        if before > after and day is not None:
            findings.append(Bottleneck(label, before - after, (as_of - day).days))
    return tuple(findings)
