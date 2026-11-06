"""Process one lease-fenced synthetic Kisumu run."""

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from dawa_api.ingestion.county_repository import CountySnapshotRepository
from dawa_api.jobs.county_repository import KISUMU_SIMULATION_VERSION, CountyRunRepository
from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.simulation.kisumu import simulate_kisumu


async def process_kisumu_one(sessions: async_sessionmaker[AsyncSession]) -> bool:
    async with sessions.begin() as session:
        run = await CountyRunRepository(session, country_code="KE", county_code="042").claim_next()
        if run is None:
            return False
        run_id, lease, seed, version = run.id, run.lease_token, run.seed, run.snapshot_version
        scenario, horizon, simulation_version = (
            run.scenario,
            run.horizon_days,
            run.simulation_version,
        )
    if lease is None:
        raise RuntimeError("Claimed county run has no lease")
    try:
        async with sessions.begin() as session:
            snapshot = await CountySnapshotRepository(
                session, country_code="KE", county_code="042"
            ).get(seed=seed, kind="pilot", version=version)
            if snapshot is None or simulation_version not in (1, KISUMU_SIMULATION_VERSION):
                raise ValueError("Pinned synthetic run inputs are unavailable")
            data = snapshot.data
        result = await asyncio.to_thread(
            simulate_kisumu,
            ScenarioCreate.model_validate(scenario),
            data,
            horizon_days=horizon,
            simulation_version=simulation_version,
        )
    except Exception:
        result = None
    async with sessions.begin() as session:
        await CountyRunRepository(session, country_code="KE", county_code="042").finish(
            run_id, lease, result
        )
    return True
