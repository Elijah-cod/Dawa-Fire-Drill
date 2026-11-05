"""Atomic per-principal, per-country fixed-window request limits."""

from hashlib import sha256

from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from dawa_api.auth.service import Principal
from dawa_api.storage.models import RequestLimit


async def reserve_request(
    sessions: async_sessionmaker[AsyncSession], principal: Principal, *, limit: int
) -> bool:
    digest = sha256(principal.subject.encode()).hexdigest()
    minute = func.date_trunc("minute", func.now())
    async with sessions.begin() as session:
        await session.execute(
            select(func.set_config("app.country_code", principal.country_code, True))
        )
        statement = (
            insert(RequestLimit)
            .values(
                country_code=principal.country_code,
                subject_hash=digest,
                window_start=minute,
                calls=1,
            )
            .on_conflict_do_update(
                index_elements=["country_code", "subject_hash"],
                set_={
                    "window_start": minute,
                    "calls": case(
                        (RequestLimit.window_start < minute, 1), else_=RequestLimit.calls + 1
                    ),
                },
                where=(RequestLimit.window_start < minute) | (RequestLimit.calls < limit),
            )
            .returning(RequestLimit.calls)
        )
        return (await session.execute(statement)).scalar_one_or_none() is not None
