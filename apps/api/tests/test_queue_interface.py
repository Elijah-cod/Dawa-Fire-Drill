"""The worker can use a queue implementation behind its interface."""

import asyncio

from dawa_api.jobs.worker import process_one


def test_worker_uses_injected_empty_queue():
    calls = []

    class Context:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    class Sessions:
        def begin(self):
            return Context()

    class EmptyQueue:
        async def claim_next(self):
            calls.append("claim")
            return None

    def factory(session, country):
        assert country == "KE"
        return EmptyQueue()

    assert asyncio.run(process_one(Sessions(), "KE", queue_factory=factory)) is False
    assert calls == ["claim"]
