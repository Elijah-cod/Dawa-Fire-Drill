"""Queue interface for claiming and finishing versioned synthetic scenario runs."""

from typing import Any, Protocol
from uuid import UUID


class ClaimedRun(Protocol):
    id: UUID
    scenario_id: UUID
    lease_token: UUID | None
    seed: int
    horizon_days: int
    generator_version: int
    simulation_version: int


class RunQueue(Protocol):
    async def claim_next(self) -> ClaimedRun | None: ...

    async def complete(self, run_id: UUID, lease: UUID, result: dict[str, Any]) -> bool: ...

    async def fail(self, run_id: UUID, lease: UUID) -> bool: ...
