"""Persist a synthetic dataset snapshot without printing database credentials."""

import argparse
import asyncio
import json

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from dawa_api.ingestion.repository import DatasetRepository
from dawa_api.settings import Settings


async def persist(seed: int, country: str) -> dict[str, object]:
    settings = Settings()
    engine = create_async_engine(settings.database_url)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False).begin() as session:
            dataset, created = await DatasetRepository(session, country_code=country).ensure(
                seed=seed
            )
            return {
                "synthetic": True,
                "country_code": dataset.country_code,
                "seed": dataset.seed,
                "generator_version": dataset.generator_version,
                "created": created,
            }
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Persist a synthetic dataset snapshot")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--country", default="KE")
    args = parser.parse_args()
    print(json.dumps(asyncio.run(persist(args.seed, args.country))))


if __name__ == "__main__":
    main()
