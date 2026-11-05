"""Run dated funding diagnostics and refresh their optional graph projection."""

import argparse
import asyncio
import json
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from dawa_api.finance_flow.graph import rebuild_country
from dawa_api.finance_flow.repository import refresh_diagnostics
from dawa_api.settings import Settings


async def run_job(
    sessions: async_sessionmaker[AsyncSession],
    *,
    country_code: str,
    as_of: date,
    uri: str,
    user: str,
    password: str,
) -> dict[str, int | bool]:
    created = await refresh_diagnostics(sessions, country_code=country_code, as_of=as_of)
    available = await rebuild_country(
        sessions, country_code=country_code, uri=uri, user=user, password=password
    )
    return {"diagnostics_created": created, "graph_available": available, "synthetic": True}


async def run(country: str, as_of: date) -> None:
    settings = Settings()
    engine = create_async_engine(settings.database_url)
    try:
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        result = await run_job(
            sessions,
            country_code=country,
            as_of=as_of,
            uri=settings.neo4j_uri,
            user=settings.neo4j_user,
            password=settings.neo4j_password,
        )
        print(json.dumps(result))
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh synthetic funding diagnostics")
    parser.add_argument("--country", default="KE")
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    args = parser.parse_args()
    asyncio.run(run(args.country, args.as_of))


if __name__ == "__main__":
    main()
