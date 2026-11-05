"""Persistent scenario metadata, partitioned by country in every lookup."""

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Scenario(Base):
    __tablename__ = "scenarios"
    __table_args__ = (
        UniqueConstraint("country_code", "idempotency_key"),
        UniqueConstraint("id", "country_code", name="uq_scenarios_id_country"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class Run(Base):
    __tablename__ = "scenario_runs"
    __table_args__ = (
        UniqueConstraint("country_code", "idempotency_key"),
        ForeignKeyConstraint(
            ["scenario_id", "country_code"], ["scenarios.id", "scenarios.country_code"]
        ),
        CheckConstraint(
            "status IN ('queued','running','succeeded','failed')", name="ck_run_status"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    scenario_id: Mapped[UUID] = mapped_column(nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    seed: Mapped[int] = mapped_column(BigInteger, nullable=False)
    horizon_days: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(String(200), nullable=True)
    lease_token: Mapped[UUID | None] = mapped_column(nullable=True)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class DailyProviderUsage(Base):
    __tablename__ = "provider_daily_usage"
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    calls: Mapped[int] = mapped_column(Integer, nullable=False)


class ExtractionCache(Base):
    __tablename__ = "extraction_cache"
    country_code: Mapped[str] = mapped_column(String(2), primary_key=True)
    image_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    schema_version: Mapped[int] = mapped_column(Integer, primary_key=True)
    fields_json: Mapped[str] = mapped_column(Text, nullable=False)


class CaptureDraft(Base):
    __tablename__ = "capture_drafts"
    __table_args__ = (
        UniqueConstraint("country_code", "idempotency_key"),
        UniqueConstraint("id", "country_code", name="uq_capture_id_country"),
        CheckConstraint("status IN ('pending','confirmed')", name="ck_capture_status"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    facility_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by: Mapped[str] = mapped_column(String(200), nullable=False)
    image_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    fields: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    provider_status: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class StockEntry(Base):
    __tablename__ = "stock_entries"
    __table_args__ = (
        UniqueConstraint("capture_id"),
        ForeignKeyConstraint(
            ["capture_id", "country_code"], ["capture_drafts.id", "capture_drafts.country_code"]
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    capture_id: Mapped[UUID] = mapped_column(nullable=False)
    facility_id: Mapped[str] = mapped_column(String(64), nullable=False)
    commodity_name: Mapped[str] = mapped_column(String(200), nullable=False)
    opening_balance: Mapped[int] = mapped_column(BigInteger, nullable=False)
    closing_balance: Mapped[int] = mapped_column(BigInteger, nullable=False)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    confirmed_by: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
