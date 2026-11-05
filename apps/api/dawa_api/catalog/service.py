"""Country-scoped catalog reads from immutable synthetic dataset snapshots."""

from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.ingestion.repository import DatasetRepository


class CatalogService:
    def __init__(self, session: AsyncSession, country_code: str) -> None:
        self.datasets = DatasetRepository(session, country_code=country_code)

    async def page(
        self,
        *,
        seed: int,
        version: int,
        kind: Literal["facilities", "commodities"],
        limit: int,
        offset: int,
    ) -> tuple[list[dict[str, Any]], int] | None:
        dataset = await self.datasets.get(seed=seed, version=version)
        if dataset is None:
            return None
        data = dataset.data
        if data.get("synthetic") is not True or data.get("country_code") != self.datasets.country:
            raise ValueError("Snapshot is not a matching synthetic dataset")
        items: list[dict[str, Any]] = data[kind]
        return items[offset : offset + limit], len(items)
