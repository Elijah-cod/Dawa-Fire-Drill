import asyncio
from types import SimpleNamespace
from uuid import uuid4

from dawa_api.finance_flow.graph import project_flow


class FakeSession:
    def __init__(self):
        self.calls = []

    async def run(self, query, **parameters):
        self.calls.append((query, parameters))


def test_project_flow_is_parameterized_and_idempotent():
    asyncio.run(check_projection())


async def check_projection():
    session = FakeSession()
    flow = SimpleNamespace(
        id=uuid4(),
        country_code="KE",
        payload={
            "approved": 100,
            "released": 70,
            "procured": 50,
            "delivered": 20,
            "approved_on": "2025-01-01",
            "released_on": "2025-01-02",
            "procured_on": "2025-01-03",
            "delivered_on": "2025-01-04",
        },
    )
    await project_flow(session, flow)
    await project_flow(session, flow)
    assert session.calls[0] == session.calls[1]
    query, params = session.calls[0]
    assert "MERGE" in query and "NEXT" in query
    assert params["country"] == "KE" and params["flow_id"] == str(flow.id)
    assert [stage["amount"] for stage in params["stages"]] == [100, 70, 50, 20]
    assert "2025-01-01" not in query


def test_unavailable_graph_does_not_break_diagnostics(monkeypatch):
    from neo4j.exceptions import ServiceUnavailable

    from dawa_api.finance_flow import graph

    class UnavailableDriver:
        async def verify_connectivity(self):
            raise ServiceUnavailable("offline")

        async def close(self):
            pass

    monkeypatch.setattr(
        graph.AsyncGraphDatabase, "driver", lambda *args, **kwargs: UnavailableDriver()
    )
    assert (
        asyncio.run(
            graph.rebuild_country(
                None, country_code="KE", uri="bolt://invalid", user="", password=""
            )
        )
        is False
    )


def test_job_runs_diagnostics_even_if_graph_is_unavailable(monkeypatch):
    from datetime import date

    from dawa_api.finance_flow import worker

    async def diagnostics(sessions, *, country_code, as_of):
        assert country_code == "KE" and as_of == date(2025, 1, 5)
        return 2

    async def graph(*args, **kwargs):
        return False

    monkeypatch.setattr(worker, "refresh_diagnostics", diagnostics)
    monkeypatch.setattr(worker, "rebuild_country", graph)
    result = asyncio.run(
        worker.run_job(
            None,
            country_code="KE",
            as_of=date(2025, 1, 5),
            uri="bolt://invalid",
            user="",
            password="",
        )
    )
    assert result == {"diagnostics_created": 2, "graph_available": False, "synthetic": True}


def test_graph_rebuild_creates_composite_uniqueness_constraints():
    from dawa_api.finance_flow.graph import ensure_constraints

    class Result:
        async def consume(self):
            return None

    class Session:
        def __init__(self):
            self.queries = []

        async def run(self, query):
            self.queries.append(query)
            return Result()

    session = Session()
    asyncio.run(ensure_constraints(session))
    assert len(session.queries) == 2
    assert all("IF NOT EXISTS" in query and "IS UNIQUE" in query for query in session.queries)
    assert any("flow_id" in query and "name" in query for query in session.queries)
