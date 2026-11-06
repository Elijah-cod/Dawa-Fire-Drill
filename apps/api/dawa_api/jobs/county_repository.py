"""County-scoped idempotent pilot queue with lease fencing."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.ingestion.county_repository import COUNTY_GENERATOR_VERSION, CountySnapshotRepository
from dawa_api.storage.models import CountyRun

KISUMU_SIMULATION_VERSION = 1


class CountyRunConflict(ValueError):
    """A county run idempotency key was reused for different inputs."""


class CountyRunRepository:
    def __init__(self, session: AsyncSession, *, country_code: str, county_code: str) -> None:
        self.snapshots = CountySnapshotRepository(
            session, country_code=country_code, county_code=county_code
        )
        self.country_code = country_code
        self.county_code = county_code
        self.session = session

    async def _set_scope(self) -> None:
        await self.session.execute(
            select(func.set_config("app.country_code", self.country_code, True))
        )
        await self.session.execute(
            select(func.set_config("app.county_code", self.county_code, True))
        )

    async def create(
        self, key: str, *, seed: int, horizon_days: int, scenario: dict[str, Any]
    ) -> tuple[CountyRun, bool]:
        if self.country_code != "KE" or self.county_code != "042":
            raise ValueError("Facility simulation is available only for Kisumu")
        if not key or len(key) > 128 or not 1 <= horizon_days <= 365:
            raise ValueError("Invalid run inputs")
        await self._set_scope()
        # Resolve existing idempotency keys before looking up a potentially different seed.
        existing = (
            await self.session.execute(
                select(CountyRun).where(
                    CountyRun.country_code == self.country_code,
                    CountyRun.county_code == self.county_code,
                    CountyRun.idempotency_key == key,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            if (existing.seed, existing.horizon_days, existing.scenario) != (
                seed,
                horizon_days,
                scenario,
            ):
                raise CountyRunConflict("Idempotency key conflicts with another run")
            return existing, False
        if await self.snapshots.get(seed=seed, kind="pilot") is None:
            raise LookupError("Synthetic pilot snapshot not found")
        statement = (
            insert(CountyRun)
            .values(
                id=uuid4(),
                country_code=self.country_code,
                county_code=self.county_code,
                idempotency_key=key,
                seed=seed,
                snapshot_version=COUNTY_GENERATOR_VERSION,
                snapshot_kind="pilot",
                simulation_version=KISUMU_SIMULATION_VERSION,
                scenario=scenario,
                horizon_days=horizon_days,
                status="queued",
                attempts=0,
            )
            .on_conflict_do_nothing(
                index_elements=["country_code", "county_code", "idempotency_key"]
            )
            .returning(CountyRun.id)
        )
        inserted = (await self.session.execute(statement)).scalar_one_or_none()
        run = (
            await self.session.execute(
                select(CountyRun).where(
                    CountyRun.country_code == self.country_code,
                    CountyRun.county_code == self.county_code,
                    CountyRun.idempotency_key == key,
                )
            )
        ).scalar_one()
        if (run.seed, run.horizon_days, run.scenario) != (seed, horizon_days, scenario):
            raise CountyRunConflict("Idempotency key conflicts with another run")
        return run, inserted is not None

    async def get(self, run_id: UUID) -> CountyRun | None:
        await self._set_scope()
        return (
            await self.session.execute(
                select(CountyRun)
                .where(
                    CountyRun.country_code == self.country_code,
                    CountyRun.county_code == self.county_code,
                    CountyRun.id == run_id,
                )
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()

    async def claim_next(self) -> CountyRun | None:
        await self._set_scope()
        now = datetime.now(UTC)
        run = (
            await self.session.execute(
                select(CountyRun)
                .where(
                    CountyRun.country_code == self.country_code,
                    CountyRun.county_code == self.county_code,
                    or_(
                        CountyRun.status == "queued",
                        and_(CountyRun.status == "running", CountyRun.lease_until < now),
                    ),
                )
                .order_by(CountyRun.created_at, CountyRun.id)
                .with_for_update(skip_locked=True)
                .limit(1)
            )
        ).scalar_one_or_none()
        if run is not None:
            run.status = "running"
            run.lease_token = uuid4()
            run.lease_until = now + timedelta(minutes=5)
            run.attempts += 1
            await self.session.flush()
        return run

    async def finish(self, run_id: UUID, lease: UUID, result: dict[str, Any] | None) -> bool:
        await self._set_scope()
        statement = (
            update(CountyRun)
            .where(
                CountyRun.id == run_id,
                CountyRun.country_code == self.country_code,
                CountyRun.county_code == self.county_code,
                CountyRun.status == "running",
                CountyRun.lease_token == lease,
            )
            .values(
                status="succeeded" if result is not None else "failed",
                result=result,
                lease_token=None,
                lease_until=None,
            )
            .returning(CountyRun.id)
        )
        return (await self.session.execute(statement)).scalar_one_or_none() is not None
