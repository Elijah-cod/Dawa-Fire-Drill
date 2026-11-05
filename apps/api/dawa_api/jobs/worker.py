"""Claim and execute one synthetic scenario run with lease fencing."""

import argparse
import asyncio
from collections.abc import Callable

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from dawa_api.countries.service import get_country
from dawa_api.ingestion.repository import GENERATOR_VERSION, DatasetRepository
from dawa_api.jobs.repository import RunRepository
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.settings import Settings
from dawa_api.simulation.scenario import ScenarioResult, simulate_scenario
from dawa_api.storage.scenarios import ScenarioRepository

Simulator = Callable[..., ScenarioResult]


async def process_one(
    sessions: async_sessionmaker[AsyncSession],
    country_code: str,
    *,
    simulator: Simulator = simulate_scenario,
) -> bool:
    country = get_country(country_code).code
    async with sessions.begin() as session:
        run = await RunRepository(session, country_code=country).claim_next()
        if run is None:
            return False
        run_id, lease, seed, horizon = run.id, run.lease_token, run.seed, run.horizon_days
        version = run.generator_version
        scenario = await ScenarioRepository(session, country_code=country).get(run.scenario_id)
        payload = scenario.payload if scenario is not None else None
    if lease is None:
        raise RuntimeError("Claimed run has no lease")
    try:
        async with sessions.begin() as session:
            datasets = DatasetRepository(session, country_code=country)
            snapshot = await datasets.get(seed=seed, version=version)
            if snapshot is None and version == GENERATOR_VERSION:
                snapshot, _ = await datasets.ensure(seed=seed)
            data = snapshot.data if snapshot is not None else None
        scenario_input = ScenarioCreate.model_validate(payload)
        if data is None:
            raise ValueError("Synthetic dataset version is unavailable")
        result = await asyncio.to_thread(
            simulator, scenario_input, seed=seed, horizon_days=horizon, dataset=data
        )
    except Exception:
        async with sessions.begin() as session:
            await RunRepository(session, country_code=country).fail(run_id, lease)
        return True
    async with sessions.begin() as session:
        await RunRepository(session, country_code=country).complete(run_id, lease, dict(result))
    return True


async def run_worker(country: str, *, once: bool, poll_seconds: int) -> None:
    settings = Settings()
    engine = create_async_engine(settings.database_url)
    try:
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        while True:
            processed = await process_one(sessions, country)
            if once:
                break
            if not processed:
                await asyncio.sleep(poll_seconds)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Process queued synthetic scenario runs")
    parser.add_argument("--country", default="KE")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--poll-seconds", type=int, default=2, choices=range(1, 61))
    args = parser.parse_args()
    asyncio.run(run_worker(args.country, once=args.once, poll_seconds=args.poll_seconds))


if __name__ == "__main__":
    main()
