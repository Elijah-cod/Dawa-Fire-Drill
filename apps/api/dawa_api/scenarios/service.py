"""Coordinate scenario creation and retrieval within a country."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.scenarios.schemas import ScenarioCreate
from dawa_api.storage.models import Scenario
from dawa_api.storage.scenarios import ScenarioRepository


class ScenarioService:
    def __init__(self, session: AsyncSession, country_code: str) -> None:
        self.repository = ScenarioRepository(session, country_code=country_code)

    async def create(self, key: str, data: ScenarioCreate) -> tuple[Scenario, bool]:
        return await self.repository.create(key, data.model_dump(mode="json"))

    async def get(self, scenario_id: UUID) -> Scenario | None:
        return await self.repository.get(scenario_id)

    async def list_page(self, limit: int, offset: int) -> list[Scenario]:
        return await self.repository.list_page(limit=limit, offset=offset)
