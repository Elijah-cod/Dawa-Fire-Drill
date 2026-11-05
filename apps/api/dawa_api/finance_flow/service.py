"""Identify amounts stalled between successive funding stages."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class FundingRecord:
    approved: int
    released: int
    procured: int
    delivered: int
    since: date


@dataclass(frozen=True)
class Bottleneck:
    stage: str
    amount: int
    age_days: int


def diagnose(record: FundingRecord, *, as_of: date) -> tuple[Bottleneck, ...]:
    values = (record.approved, record.released, record.procured, record.delivered)
    if any(value < 0 for value in values) or any(
        a < b for a, b in zip(values, values[1:], strict=False)
    ):
        raise ValueError("Funding stages must be nonnegative and nonincreasing")
    if as_of < record.since:
        raise ValueError("as_of must not precede the record date")
    labels = ("approved_not_released", "released_not_procured", "procured_not_delivered")
    return tuple(
        Bottleneck(label, a - b, (as_of - record.since).days)
        for label, a, b in zip(labels, values, values[1:], strict=False)
        if a > b
    )
