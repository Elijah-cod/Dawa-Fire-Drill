"""Adapter boundary for future verified public aggregates, never facility records."""

from dataclasses import dataclass
from typing import Literal, Protocol

AggregateMeasure = Literal["commodity_demand", "delivery_lead_time", "funding_flows"]


@dataclass(frozen=True)
class PublicAggregate:
    measure: AggregateMeasure
    country_code: str
    value: float
    unit: str
    period: str
    source_url: str


class AggregateUnavailable(LookupError):
    """No reviewed public aggregate source has been configured."""


class PublicAggregateSource(Protocol):
    def get(self, *, measure: AggregateMeasure, country_code: str) -> PublicAggregate: ...


class UnconfiguredAggregateSource:
    def get(self, *, measure: AggregateMeasure, country_code: str) -> PublicAggregate:
        # TODO: implement reviewed, provenance-preserving public aggregate adapters.
        raise AggregateUnavailable(f"No public aggregate adapter for {country_code}: {measure}")
