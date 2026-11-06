"""Extract one synthetic facility without returning neighboring facility data."""

from typing import Any


def facility_view(snapshot: dict[str, Any], *, facility_id: str) -> dict[str, Any]:
    matching = [facility for facility in snapshot["facilities"] if facility["id"] == facility_id]
    if len(matching) != 1:
        raise LookupError("Synthetic facility not found")
    return {
        "synthetic": True,
        "notice": "Illustrative synthetic facility data; not real records",
        "country_code": "KE",
        "county_code": "042",
        "facility": matching[0],
        "stock": [row for row in snapshot["stock"] if row["facility_id"] == facility_id],
        "consumption": [
            row for row in snapshot["consumption"] if row["facility_id"] == facility_id
        ],
        "commodities": snapshot["commodities"],
    }
