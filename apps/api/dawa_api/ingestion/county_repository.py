"""Immutable county-scoped synthetic planning and Kisumu pilot snapshots."""

import asyncio
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.countries.ke.counties import county_by_code
from dawa_api.ingestion.county_planning import generate_county_planning
from dawa_api.ingestion.kisumu import generate_kisumu_panel
from dawa_api.storage.models import CountySnapshot

COUNTY_GENERATOR_VERSION = 1
SnapshotKind = Literal["planning", "pilot"]


class CountySnapshotRepository:
    def __init__(self, session: AsyncSession, *, country_code: str, county_code: str) -> None:
        if country_code != "KE":
            raise ValueError("County generation is configured only for Kenya")
        self.county_code = county_by_code(county_code).code
        self.country_code = country_code
        self.session = session

    async def _set_scope(self) -> None:
        await self.session.execute(
            select(func.set_config("app.country_code", self.country_code, True))
        )
        await self.session.execute(
            select(func.set_config("app.county_code", self.county_code, True))
        )

    async def get(
        self, *, seed: int, kind: SnapshotKind, version: int = COUNTY_GENERATOR_VERSION
    ) -> CountySnapshot | None:
        await self._set_scope()
        statement = select(CountySnapshot).where(
            CountySnapshot.country_code == self.country_code,
            CountySnapshot.county_code == self.county_code,
            CountySnapshot.seed == seed,
            CountySnapshot.version == version,
            CountySnapshot.kind == kind,
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def ensure(self, *, seed: int, kind: SnapshotKind) -> tuple[CountySnapshot, bool]:
        if not -(2**63) <= seed < 2**63 or kind not in ("planning", "pilot"):
            raise ValueError("Invalid synthetic snapshot request")
        if kind == "pilot" and self.county_code != "042":
            raise ValueError("Facility simulation is available only for Kisumu")
        existing = await self.get(seed=seed, kind=kind)
        if existing is not None:
            return existing, False
        if kind == "pilot":
            data = await asyncio.to_thread(generate_kisumu_panel, seed=seed)
        else:
            national = await asyncio.to_thread(generate_county_planning, seed=seed)
            record = next(
                row for row in national["counties"] if row["county_code"] == self.county_code
            )
            data = {
                **record,
                "seed": seed,
                "notice": national["notice"],
                "calibration": national["calibration"],
            }
        statement = (
            insert(CountySnapshot)
            .values(
                country_code=self.country_code,
                county_code=self.county_code,
                seed=seed,
                version=COUNTY_GENERATOR_VERSION,
                kind=kind,
                data=data,
            )
            .on_conflict_do_nothing(
                index_elements=["country_code", "county_code", "seed", "version", "kind"]
            )
            .returning(CountySnapshot.seed)
        )
        inserted = (await self.session.execute(statement)).scalar_one_or_none()
        snapshot = await self.get(seed=seed, kind=kind)
        if snapshot is None:
            raise RuntimeError("County snapshot could not be read after insertion")
        return snapshot, inserted is not None
