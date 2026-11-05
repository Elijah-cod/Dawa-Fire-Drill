"""Unconfigured aggregate adapters must not fabricate calibration inputs."""

import pytest

from dawa_api.ingestion.aggregate_adapters import AggregateUnavailable, UnconfiguredAggregateSource


def test_missing_public_aggregates_fail_explicitly():
    source = UnconfiguredAggregateSource()
    for measure in ("commodity_demand", "delivery_lead_time", "funding_flows"):
        with pytest.raises(AggregateUnavailable, match=measure):
            source.get(measure=measure, country_code="KE")
