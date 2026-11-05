"""Country-scoped immutable funding flows and dated diagnostics."""

from dataclasses import asdict
from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from dawa_api.finance_flow.schemas import FundingTraceRequest
from dawa_api.finance_flow.trace import FundingTranche, trace_funding
from dawa_api.storage.models import FundingDiagnostic, FundingFlow
from dawa_api.storage.scenarios import ScenarioRepository


class FundingConflict(ValueError):
    """Funding idempotency key was reused for different inputs."""


class FundingRepository:
    def __init__(self, session: AsyncSession, *, country_code: str) -> None:
        self.session = session
        self.country = ScenarioRepository(session, country_code=country_code).country_code

    async def _set_country(self) -> None:
        await self.session.execute(select(func.set_config("app.country_code", self.country, True)))

    async def create(self, key: str, data: FundingTraceRequest) -> tuple[FundingFlow, bool]:
        if not key or len(key) > 128:
            raise ValueError("Invalid idempotency key")
        trace_funding(
            FundingTranche(**data.model_dump(exclude={"as_of", "synthetic_attested"})),
            as_of=data.as_of,
        )
        payload = data.model_dump(mode="json", exclude={"as_of", "synthetic_attested"})
        await self._set_country()
        statement = (
            insert(FundingFlow)
            .values(id=uuid4(), country_code=self.country, idempotency_key=key, payload=payload)
            .on_conflict_do_nothing(index_elements=["country_code", "idempotency_key"])
            .returning(FundingFlow.id)
        )
        inserted = (await self.session.execute(statement)).scalar_one_or_none()
        record = (
            await self.session.execute(
                select(FundingFlow).where(
                    FundingFlow.country_code == self.country, FundingFlow.idempotency_key == key
                )
            )
        ).scalar_one()
        if record.payload != payload:
            raise FundingConflict(
                "Idempotency key is already associated with different funding inputs"
            )
        return record, inserted is not None

    async def get(self, flow_id: UUID) -> FundingFlow | None:
        await self._set_country()
        return (
            await self.session.execute(
                select(FundingFlow).where(
                    FundingFlow.country_code == self.country, FundingFlow.id == flow_id
                )
            )
        ).scalar_one_or_none()

    async def list_page(self, *, limit: int, offset: int) -> list[FundingFlow]:
        if not 1 <= limit <= 100 or offset < 0:
            raise ValueError("Invalid pagination")
        await self._set_country()
        result = await self.session.execute(
            select(FundingFlow)
            .where(FundingFlow.country_code == self.country)
            .order_by(FundingFlow.created_at, FundingFlow.id)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars())

    async def get_diagnostic(self, flow_id: UUID, *, as_of: date) -> FundingDiagnostic | None:
        await self._set_country()
        return (
            await self.session.execute(
                select(FundingDiagnostic).where(
                    FundingDiagnostic.country_code == self.country,
                    FundingDiagnostic.flow_id == flow_id,
                    FundingDiagnostic.as_of == as_of,
                )
            )
        ).scalar_one_or_none()

    async def record_diagnostic(self, flow: FundingFlow, *, as_of: date) -> bool:
        await self._set_country()
        data = FundingTraceRequest.model_validate(
            flow.payload | {"as_of": as_of, "synthetic_attested": True}
        )
        findings = trace_funding(
            FundingTranche(**data.model_dump(exclude={"as_of", "synthetic_attested"})), as_of=as_of
        )
        statement = (
            insert(FundingDiagnostic)
            .values(
                country_code=self.country,
                flow_id=flow.id,
                as_of=as_of,
                findings=[asdict(x) for x in findings],
            )
            .on_conflict_do_nothing(index_elements=["country_code", "flow_id", "as_of"])
            .returning(FundingDiagnostic.flow_id)
        )
        return (await self.session.execute(statement)).scalar_one_or_none() is not None


async def refresh_diagnostics(
    sessions: async_sessionmaker[AsyncSession], *, country_code: str, as_of: date
) -> int:
    total, offset = 0, 0
    while True:
        async with sessions.begin() as session:
            repo = FundingRepository(session, country_code=country_code)
            flows = await repo.list_page(limit=100, offset=offset)
            for flow in flows:
                # Do not create a historical diagnostic before all recorded stages exist.
                if any(
                    value and value > as_of.isoformat()
                    for key, value in flow.payload.items()
                    if key.endswith("_on")
                ):
                    continue
                total += int(await repo.record_diagnostic(flow, as_of=as_of))
        if len(flows) < 100:
            return total
        offset += len(flows)
