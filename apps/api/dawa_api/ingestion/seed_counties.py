"""Persist reproducible synthetic planning snapshots and the Kisumu pilot."""

import argparse
import asyncio
import json
from typing import Literal, TypedDict

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from dawa_api.countries.ke.counties import KENYA_COUNTIES
from dawa_api.ingestion.county_repository import CountySnapshotRepository
from dawa_api.settings import Settings


class SeedResult(TypedDict):
    synthetic: Literal[True]
    planning_created: int
    pilot_created: int


async def seed_counties(sessions: async_sessionmaker[AsyncSession], *, seed: int) -> SeedResult:
    planning_created = 0
    async with sessions.begin() as session:
        for county in KENYA_COUNTIES:
            _, created = await CountySnapshotRepository(
                session, country_code="KE", county_code=county.code
            ).ensure(seed=seed, kind="planning")
            planning_created += int(created)
        _, pilot_created = await CountySnapshotRepository(
            session, country_code="KE", county_code="042"
        ).ensure(seed=seed, kind="pilot")
    return {
        "synthetic": True,
        "planning_created": planning_created,
        "pilot_created": int(pilot_created),
    }


async def run(seed: int) -> SeedResult:
    settings = Settings()
    engine = create_async_engine(settings.database_url)
    try:
        return await seed_counties(async_sessionmaker(engine, expire_on_commit=False), seed=seed)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed synthetic county planning and Kisumu pilot")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args.seed))))


if __name__ == "__main__":
    main()
