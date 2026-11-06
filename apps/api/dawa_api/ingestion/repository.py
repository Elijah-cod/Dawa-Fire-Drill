"""Persist a country-scoped immutable snapshot for each generator version and seed."""

import asyncio

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.countries.service import get_country
from dawa_api.ingestion.synthetic import generate_dataset
from dawa_api.storage.models import SyntheticDataset
from dawa_api.storage.scenarios import ScenarioRepository

GENERATOR_VERSION = 3


class DatasetRepository:
    def __init__(self, session: AsyncSession, *, country_code: str) -> None:
        self.session = session
        self.country = ScenarioRepository(session, country_code=country_code).country_code

    async def get(self, *, seed: int, version: int = GENERATOR_VERSION) -> SyntheticDataset | None:
        await self.session.execute(select(func.set_config("app.country_code", self.country, True)))
        statement = select(SyntheticDataset).where(
            SyntheticDataset.country_code == self.country,
            SyntheticDataset.seed == seed,
            SyntheticDataset.generator_version == version,
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def ensure(self, *, seed: int) -> tuple[SyntheticDataset, bool]:
        if not -(2**63) <= seed < 2**63:
            raise ValueError("seed is outside signed 64-bit range")
        if get_country(self.country).code != "KE":
            raise ValueError("Synthetic generation is not configured for this country")
        existing = await self.get(seed=seed)
        if existing is not None:
            return existing, False
        data = await asyncio.to_thread(generate_dataset, seed=seed)
        statement = (
            insert(SyntheticDataset)
            .values(
                country_code=self.country, seed=seed, generator_version=GENERATOR_VERSION, data=data
            )
            .on_conflict_do_nothing(index_elements=["country_code", "seed", "generator_version"])
            .returning(SyntheticDataset.seed)
        )
        inserted = (await self.session.execute(statement)).scalar_one_or_none()
        dataset = await self.get(seed=seed)
        if dataset is None:
            raise RuntimeError("Synthetic dataset could not be read after insertion")
        return dataset, inserted is not None
