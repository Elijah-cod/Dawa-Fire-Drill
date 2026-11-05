"""Provider-neutral extraction with validation, retries, budget, and cache."""

from dataclasses import dataclass
from datetime import date
from hashlib import sha256
from typing import Protocol

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class BinCardFields(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    commodity_name: str | None = Field(max_length=200)
    opening_balance: int | None = Field(ge=0, le=1_000_000_000)
    closing_balance: int | None = Field(ge=0, le=1_000_000_000)
    record_date: date | None = Field(strict=False)

    @field_validator("commodity_name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        return (value.strip() or None) if value is not None else None


class Provider(Protocol):
    async def extract(self, image: bytes) -> str: ...


class ExtractionStore(Protocol):
    async def reserve(self) -> bool: ...
    async def get(self, country: str, digest: str) -> str | None: ...
    async def put(self, country: str, digest: str, value: str) -> None: ...


class ProviderUnavailable(RuntimeError):
    """Every configured provider failed or none is configured."""


class DailyLimitExceeded(RuntimeError):
    """The shared daily provider-call limit has been reached."""


@dataclass(frozen=True)
class Extraction:
    fields: BinCardFields
    digest: str
    cached: bool


class ExtractionCoordinator:
    def __init__(
        self,
        providers: list[Provider],
        store: ExtractionStore,
        *,
        attempts_per_provider: int = 2,
        cache_enabled: bool = True,
    ) -> None:
        if not 1 <= attempts_per_provider <= 3:
            raise ValueError("attempts_per_provider must be 1 to 3")
        self.providers = providers
        self.store = store
        self.attempts = attempts_per_provider
        self.cache_enabled = cache_enabled

    async def extract(self, country: str, image: bytes) -> Extraction:
        digest = sha256(image).hexdigest()
        cached = await self.store.get(country, digest) if self.cache_enabled else None
        if cached is not None:
            try:
                return Extraction(BinCardFields.model_validate_json(cached), digest, True)
            except ValidationError:
                pass
        for provider in self.providers:
            for _ in range(self.attempts):
                if not await self.store.reserve():
                    raise DailyLimitExceeded("Daily extraction call limit reached")
                try:
                    fields = BinCardFields.model_validate_json(await provider.extract(image))
                except (httpx.HTTPError, ValueError, KeyError, TypeError, RuntimeError):
                    fields = None
                if fields is None:
                    continue
                if self.cache_enabled:
                    await self.store.put(country, digest, fields.model_dump_json())
                return Extraction(fields, digest, False)
        raise ProviderUnavailable("Extraction providers are unavailable")
