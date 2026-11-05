"""Rebuildable synthetic funding projection; Postgres remains authoritative."""

from typing import Any, Protocol

from neo4j import AsyncGraphDatabase
from neo4j.exceptions import DriverError, Neo4jError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from dawa_api.finance_flow.repository import FundingRepository
from dawa_api.storage.models import FundingFlow


class GraphSession(Protocol):
    async def run(self, query: str, **parameters: Any) -> Any: ...


_QUERY = """
MERGE (flow:FundingFlow {country_code: $country, flow_id: $flow_id})
SET flow.synthetic = true
WITH flow
UNWIND $stages AS stage
MERGE (node:FundingStage {country_code: $country, flow_id: $flow_id, name: stage.name})
SET node.amount = stage.amount, node.recorded_on = stage.recorded_on, node.synthetic = true
MERGE (flow)-[:HAS_STAGE]->(node)
WITH DISTINCT flow
MATCH (a:FundingStage {country_code: $country, flow_id: $flow_id})
MATCH (b:FundingStage {country_code: $country, flow_id: $flow_id})
WHERE (a.name = 'approved' AND b.name = 'released') OR
      (a.name = 'released' AND b.name = 'procured') OR
      (a.name = 'procured' AND b.name = 'delivered')
MERGE (a)-[:NEXT]->(b)
"""


async def project_flow(session: GraphSession, flow: FundingFlow) -> None:
    stages = [
        {"name": name, "amount": flow.payload[name], "recorded_on": flow.payload[name + "_on"]}
        for name in ("approved", "released", "procured", "delivered")
    ]
    await session.run(_QUERY, country=flow.country_code, flow_id=str(flow.id), stages=stages)


async def ensure_constraints(session: GraphSession) -> None:
    for query in (
        "CREATE CONSTRAINT dawa_funding_flow_key IF NOT EXISTS "
        "FOR (flow:FundingFlow) REQUIRE (flow.country_code, flow.flow_id) IS UNIQUE",
        "CREATE CONSTRAINT dawa_funding_stage_key IF NOT EXISTS "
        "FOR (stage:FundingStage) "
        "REQUIRE (stage.country_code, stage.flow_id, stage.name) IS UNIQUE",
    ):
        result = await session.run(query)
        await result.consume()


async def rebuild_country(
    sessions: async_sessionmaker[AsyncSession],
    *,
    country_code: str,
    uri: str,
    user: str,
    password: str,
) -> bool:
    """Project immutable records; return False when the optional graph is unavailable."""
    auth = (user, password) if password else None
    driver = AsyncGraphDatabase.driver(uri, auth=auth, connection_timeout=3)
    try:
        await driver.verify_connectivity()
        offset = 0
        async with driver.session() as graph:
            await ensure_constraints(graph)
            while True:
                async with sessions.begin() as session:
                    flows = await FundingRepository(session, country_code=country_code).list_page(
                        limit=100, offset=offset
                    )
                    for flow in flows:
                        await project_flow(graph, flow)
                if len(flows) < 100:
                    return True
                offset += len(flows)
    except (DriverError, Neo4jError, OSError):
        return False
    finally:
        await driver.close()
