"""Persistent provider budget, extraction cache, and reviewed synthetic stock."""

from datetime import UTC, datetime
from hashlib import sha256
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from dawa_api.capture.extraction import BinCardFields
from dawa_api.storage.models import CaptureDraft, DailyProviderUsage, ExtractionCache, StockEntry
from dawa_api.storage.scenarios import ScenarioRepository


class CaptureConflict(ValueError):
    """A capture key or confirmation was reused with different values."""


async def _set_country(session: AsyncSession, country: str) -> str:
    normalized = ScenarioRepository(session, country_code=country).country_code
    await session.execute(select(func.set_config("app.country_code", normalized, True)))
    return normalized


class PostgresExtractionStore:
    def __init__(self, sessions: async_sessionmaker[AsyncSession], *, daily_cap: int) -> None:
        if daily_cap < 0:
            raise ValueError("daily_cap must be nonnegative")
        self.sessions, self.daily_cap = sessions, daily_cap

    async def reserve(self) -> bool:
        if self.daily_cap == 0:
            return False
        async with self.sessions.begin() as session:
            statement = (
                insert(DailyProviderUsage)
                .values(day=datetime.now(UTC).date(), calls=1)
                .on_conflict_do_update(
                    index_elements=["day"],
                    set_={"calls": DailyProviderUsage.calls + 1},
                    where=DailyProviderUsage.calls < self.daily_cap,
                )
                .returning(DailyProviderUsage.calls)
            )
            return (await session.execute(statement)).scalar_one_or_none() is not None

    async def get(self, country: str, digest: str) -> str | None:
        async with self.sessions.begin() as session:
            country = await _set_country(session, country)
            statement = select(ExtractionCache.fields_json).where(
                ExtractionCache.country_code == country,
                ExtractionCache.image_hash == digest,
                ExtractionCache.schema_version == 1,
            )
            return (await session.execute(statement)).scalar_one_or_none()

    async def put(self, country: str, digest: str, value: str) -> None:
        async with self.sessions.begin() as session:
            country = await _set_country(session, country)
            statement = (
                insert(ExtractionCache)
                .values(
                    country_code=country, image_hash=digest, schema_version=1, fields_json=value
                )
                .on_conflict_do_update(
                    index_elements=["country_code", "image_hash", "schema_version"],
                    set_={"fields_json": value},
                )
            )
            await session.execute(statement)


class CaptureRepository:
    def __init__(self, session: AsyncSession, *, country_code: str) -> None:
        self.session = session
        self.country = ScenarioRepository(session, country_code=country_code).country_code

    async def find_by_key(self, key: str) -> CaptureDraft | None:
        await _set_country(self.session, self.country)
        statement = select(CaptureDraft).where(
            CaptureDraft.country_code == self.country, CaptureDraft.idempotency_key == key
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def list_page(self, *, facility_id: str, limit: int, offset: int) -> list[CaptureDraft]:
        if not 1 <= limit <= 100 or offset < 0:
            raise ValueError("Invalid pagination")
        await _set_country(self.session, self.country)
        statement = (
            select(CaptureDraft)
            .where(
                CaptureDraft.country_code == self.country, CaptureDraft.facility_id == facility_id
            )
            .order_by(CaptureDraft.created_at, CaptureDraft.id)
            .limit(limit)
            .offset(offset)
        )
        return list((await self.session.execute(statement)).scalars())

    async def get(self, capture_id: UUID, *, lock: bool = False) -> CaptureDraft | None:
        await _set_country(self.session, self.country)
        statement = (
            select(CaptureDraft)
            .where(CaptureDraft.country_code == self.country, CaptureDraft.id == capture_id)
            .execution_options(populate_existing=True)
        )
        if lock:
            statement = statement.with_for_update()
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def create(
        self,
        key: str,
        facility_id: str,
        subject: str,
        digest: str,
        fields: BinCardFields,
        provider_status: str,
    ) -> tuple[CaptureDraft, bool]:
        if not key or len(key) > 128 or not facility_id or len(facility_id) > 64:
            raise ValueError("Invalid capture key or facility")
        if not subject or len(subject) > 200 or len(digest) != len(sha256().hexdigest()):
            raise ValueError("Invalid capture subject or image hash")
        await _set_country(self.session, self.country)
        statement = (
            insert(CaptureDraft)
            .values(
                id=uuid4(),
                country_code=self.country,
                idempotency_key=key,
                facility_id=facility_id,
                created_by=subject,
                image_hash=digest,
                fields=fields.model_dump(mode="json"),
                provider_status=provider_status,
                status="pending",
            )
            .on_conflict_do_nothing(index_elements=["country_code", "idempotency_key"])
            .returning(CaptureDraft.id)
        )
        inserted = (await self.session.execute(statement)).scalar_one_or_none()
        draft = await self.find_by_key(key)
        if draft is None:
            raise RuntimeError("Capture could not be read after insertion")
        if (draft.facility_id, draft.created_by, draft.image_hash) != (
            facility_id,
            subject,
            digest,
        ):
            raise CaptureConflict("Idempotency key is already associated with another capture")
        return draft, inserted is not None

    async def confirm(
        self, capture_id: UUID, fields: BinCardFields, subject: str, *, reviewed: bool
    ) -> tuple[StockEntry, bool]:
        if not reviewed:
            raise ValueError("Human review is required")
        if (
            not fields.commodity_name
            or fields.opening_balance is None
            or fields.closing_balance is None
            or fields.record_date is None
        ):
            raise ValueError("All reviewed stock fields are required")
        draft = await self.get(capture_id, lock=True)
        if draft is None:
            raise LookupError("Capture not found")
        existing = (
            await self.session.execute(
                select(StockEntry).where(
                    StockEntry.country_code == self.country, StockEntry.capture_id == capture_id
                )
            )
        ).scalar_one_or_none()
        if existing:
            current: tuple[Any, ...] = (
                existing.commodity_name,
                existing.opening_balance,
                existing.closing_balance,
                existing.record_date,
            )
            incoming = (
                fields.commodity_name,
                fields.opening_balance,
                fields.closing_balance,
                fields.record_date,
            )
            if current != incoming:
                raise CaptureConflict("Capture already confirmed with different values")
            return existing, False
        entry = StockEntry(
            id=uuid4(),
            country_code=self.country,
            capture_id=capture_id,
            facility_id=draft.facility_id,
            commodity_name=fields.commodity_name,
            opening_balance=fields.opening_balance,
            closing_balance=fields.closing_balance,
            record_date=fields.record_date,
            confirmed_by=subject,
        )
        self.session.add(entry)
        draft.status = "confirmed"
        await self.session.flush()
        return entry, True
