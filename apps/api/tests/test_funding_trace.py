from datetime import date

import pytest

from dawa_api.finance_flow.trace import FundingTranche, trace_funding


def test_trace_uses_each_stage_date_for_ageing() -> None:
    tranche = FundingTranche(
        approved=100,
        released=80,
        procured=50,
        delivered=40,
        approved_on=date(2026, 1, 1),
        released_on=date(2026, 1, 4),
        procured_on=date(2026, 1, 7),
        delivered_on=date(2026, 1, 9),
    )
    result = trace_funding(tranche, as_of=date(2026, 1, 11))
    assert [(x.stage, x.amount, x.age_days) for x in result] == [
        ("approved_not_released", 20, 10),
        ("released_not_procured", 30, 7),
        ("procured_not_delivered", 10, 4),
    ]


def test_trace_rejects_missing_or_out_of_order_stage_dates() -> None:
    with pytest.raises(ValueError):
        trace_funding(
            FundingTranche(10, 5, 0, 0, date(2026, 1, 1), None, None, None), as_of=date(2026, 1, 5)
        )
    with pytest.raises(ValueError):
        trace_funding(
            FundingTranche(10, 5, 0, 0, date(2026, 1, 2), date(2026, 1, 1), None, None),
            as_of=date(2026, 1, 5),
        )
