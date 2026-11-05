"""Country-scoped job submissions and lease-fenced worker claims."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.ingestion.repository import GENERATOR_VERSION
from dawa_api.simulation.scenario import SIMULATION_VERSION
from dawa_api.storage.models import Run
from dawa_api.storage.scenarios import ScenarioRepository


class RunConflict(ValueError):
    """A run idempotency key was reused with different inputs."""


class RunRepository:
    def __init__(self, session: AsyncSession, *, country_code: str) -> None:
        self.session = session
        self.scenarios = ScenarioRepository(session, country_code=country_code)
        self.country_code = self.scenarios.country_code

    async def _set_country(self) -> None:
        await self.session.execute(
            select(func.set_config("app.country_code", self.country_code, True))
        )

    async def create(
        self, scenario_id: UUID, key: str, *, seed: int, horizon_days: int
    ) -> tuple[Run, bool]:
        if (
            not key
            or len(key) > 128
            or not 1 <= horizon_days <= 365
            or not -(2**63) <= seed < 2**63
        ):
            raise ValueError("Invalid run inputs")
        if await self.scenarios.get(scenario_id) is None:
            raise LookupError("Scenario not found")
        statement = (
            insert(Run)
            .values(
                id=uuid4(),
                country_code=self.country_code,
                scenario_id=scenario_id,
                idempotency_key=key,
                seed=seed,
                generator_version=GENERATOR_VERSION,
                simulation_version=SIMULATION_VERSION,
                horizon_days=horizon_days,
                status="queued",
                attempts=0,
            )
            .on_conflict_do_nothing(index_elements=["country_code", "idempotency_key"])
            .returning(Run.id)
        )
        inserted = (await self.session.execute(statement)).scalar_one_or_none()
        run = (
            await self.session.execute(
                select(Run).where(Run.country_code == self.country_code, Run.idempotency_key == key)
            )
        ).scalar_one()
        if (run.scenario_id, run.seed, run.horizon_days) != (scenario_id, seed, horizon_days):
            raise RunConflict("Idempotency key is already associated with different run inputs")
        return run, inserted is not None

    async def get(self, run_id: UUID) -> Run | None:
        await self._set_country()
        return (
            await self.session.execute(
                select(Run)
                .where(Run.country_code == self.country_code, Run.id == run_id)
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()

    async def list_page(self, *, scenario_id: UUID, limit: int, offset: int) -> list[Run]:
        if not 1 <= limit <= 100 or offset < 0:
            raise ValueError("Invalid pagination")
        await self._set_country()
        result = await self.session.execute(
            select(Run)
            .where(Run.country_code == self.country_code, Run.scenario_id == scenario_id)
            .order_by(Run.created_at, Run.id)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars())

    async def claim_next(self) -> Run | None:
        await self._set_country()
        now = datetime.now(UTC)
        result = await self.session.execute(
            select(Run)
            .where(
                Run.country_code == self.country_code,
                or_(Run.status == "queued", and_(Run.status == "running", Run.lease_until < now)),
            )
            .order_by(Run.created_at, Run.id)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        run = result.scalar_one_or_none()
        if run is not None:
            run.status = "running"
            run.lease_token = uuid4()
            run.lease_until = now + timedelta(minutes=5)
            run.attempts += 1
            await self.session.flush()
        return run

    async def complete(self, run_id: UUID, lease: UUID, result: dict[str, Any]) -> bool:
        await self._set_country()
        statement = (
            update(Run)
            .where(
                Run.id == run_id,
                Run.country_code == self.country_code,
                Run.status == "running",
                Run.lease_token == lease,
            )
            .values(status="succeeded", result=result, lease_token=None, lease_until=None)
            .returning(Run.id)
        )
        return (await self.session.execute(statement)).scalar_one_or_none() is not None

    async def fail(self, run_id: UUID, lease: UUID) -> bool:
        await self._set_country()
        statement = (
            update(Run)
            .where(
                Run.id == run_id,
                Run.country_code == self.country_code,
                Run.status == "running",
                Run.lease_token == lease,
            )
            .values(
                status="failed", error="Scenario run failed", lease_token=None, lease_until=None
            )
            .returning(Run.id)
        )
        return (await self.session.execute(statement)).scalar_one_or_none() is not None
