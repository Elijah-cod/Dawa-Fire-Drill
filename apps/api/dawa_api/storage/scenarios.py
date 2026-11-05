"""Country-scoped scenario repository with atomic idempotent creation."""

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.storage.models import Scenario


class IdempotencyConflict(ValueError):
    """An idempotency key was reused with a different payload."""


class ScenarioRepository:
    def __init__(self, session: AsyncSession, *, country_code: str) -> None:
        if len(country_code) != 2 or not country_code.isascii() or not country_code.isalpha():
            raise ValueError("country_code must be two ASCII letters")
        self.session = session
        self.country_code = country_code.upper()

    async def create(self, key: str, payload: dict[str, Any]) -> tuple[Scenario, bool]:
        if not key or len(key) > 128:
            raise ValueError("idempotency key must contain 1 to 128 characters")
        statement = (
            insert(Scenario)
            .values(
                id=uuid4(), country_code=self.country_code, idempotency_key=key, payload=payload
            )
            .on_conflict_do_nothing(index_elements=["country_code", "idempotency_key"])
            .returning(Scenario.id)
        )
        inserted_id = (await self.session.execute(statement)).scalar_one_or_none()
        scenario = (
            await self.session.execute(
                select(Scenario).where(
                    Scenario.country_code == self.country_code, Scenario.idempotency_key == key
                )
            )
        ).scalar_one()
        if scenario.payload != payload:
            raise IdempotencyConflict("Idempotency key is already associated with another payload")
        return scenario, inserted_id is not None

    async def get(self, scenario_id: UUID) -> Scenario | None:
        return (
            await self.session.execute(
                select(Scenario).where(
                    Scenario.country_code == self.country_code, Scenario.id == scenario_id
                )
            )
        ).scalar_one_or_none()

    async def list_page(self, *, limit: int, offset: int) -> list[Scenario]:
        if not 1 <= limit <= 100 or offset < 0:
            raise ValueError("limit must be 1 to 100 and offset must be nonnegative")
        result = await self.session.execute(
            select(Scenario)
            .where(Scenario.country_code == self.country_code)
            .order_by(Scenario.created_at, Scenario.id)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars())
