import asyncio

import pytest

from dawa_api.capture.extraction import (
    DailyLimitExceeded,
    ExtractionCoordinator,
    ProviderUnavailable,
)

VALID = (
    '{"commodity_name":"Synthetic item","opening_balance":5,"closing_balance":3,"record_date":null}'
)


class MemoryStore:
    def __init__(self, cap: int) -> None:
        self.cap = cap
        self.calls = 0
        self.cache: dict[tuple[str, str], str] = {}

    async def reserve(self) -> bool:
        if self.calls >= self.cap:
            return False
        self.calls += 1
        return True

    async def get(self, country: str, digest: str) -> str | None:
        return self.cache.get((country, digest))

    async def put(self, country: str, digest: str, value: str) -> None:
        self.cache[(country, digest)] = value


class FakeProvider:
    def __init__(self, responses: list[str | Exception]) -> None:
        self.responses = responses
        self.calls = 0

    async def extract(self, image: bytes) -> str:
        value = self.responses[self.calls]
        self.calls += 1
        if isinstance(value, Exception):
            raise value
        return value


def test_retry_schema_validation_cache_and_country_scope() -> None:
    async def run() -> None:
        store = MemoryStore(cap=4)
        provider = FakeProvider(["not json", VALID, VALID])
        service = ExtractionCoordinator([provider], store, attempts_per_provider=2)
        first = await service.extract("KE", b"synthetic image")
        assert first.fields.closing_balance == 3 and not first.cached
        assert (await service.extract("KE", b"synthetic image")).cached
        assert not (await service.extract("ZZ", b"synthetic image")).cached
        assert store.calls == 3

    asyncio.run(run())


def test_fallback_and_call_cap_fail_closed() -> None:
    async def run() -> None:
        store = MemoryStore(cap=3)
        primary = FakeProvider([RuntimeError("unavailable"), RuntimeError("unavailable")])
        fallback = FakeProvider([VALID])
        result = await ExtractionCoordinator(
            [primary, fallback], store, attempts_per_provider=2
        ).extract("KE", b"synthetic image")
        assert result.fields.opening_balance == 5 and fallback.calls == 1
        with pytest.raises(DailyLimitExceeded):
            await ExtractionCoordinator([fallback], store, attempts_per_provider=1).extract(
                "KE", b"new image"
            )
        with pytest.raises(ProviderUnavailable):
            await ExtractionCoordinator([], MemoryStore(cap=1)).extract("KE", b"image")

    asyncio.run(run())
