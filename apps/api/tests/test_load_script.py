"""Ensure the load script sends only attested synthetic payloads."""

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


def test_load_script_uses_synthetic_requests(monkeypatch):
    class FakeClient:
        def __init__(self):
            self.requests = []

        def post(self, path, **kwargs):
            self.requests.append((path, kwargs))

    fake_locust = ModuleType("locust")
    fake_locust.HttpUser = object
    fake_locust.between = lambda *args: None
    fake_locust.task = lambda *args: lambda func: func
    monkeypatch.setitem(sys.modules, "locust", fake_locust)
    monkeypatch.setenv("DAWA_LOAD_TOKEN", "synthetic-test-token")
    path = Path(__file__).resolve().parents[3] / "infra" / "load" / "locustfile.py"
    spec = importlib.util.spec_from_file_location("synthetic_load_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    user = module.SyntheticPlanner()
    user.client = FakeClient()
    user.forecast()
    user.rank()
    assert {path for path, _ in user.client.requests} == {"/v1/forecast", "/v1/optimization/rank"}
    for _, request in user.client.requests:
        assert request["json"]["synthetic_attested"] is True
        assert request["headers"]["Authorization"] == "Bearer synthetic-test-token"
