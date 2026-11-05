"""Local-only smoke load with attested synthetic planning payloads."""

import os

from locust import HttpUser, between, task


class SyntheticPlanner(HttpUser):
    wait_time = between(1, 2)

    @task(1)
    def health(self):
        self.client.get("/health", name="/health")

    @task(2)
    def forecast(self):
        self.client.post(
            "/v1/forecast",
            name="/v1/forecast",
            headers={"Authorization": f"Bearer {os.environ['DAWA_LOAD_TOKEN']}"},
            json={
                "synthetic_attested": True,
                "history": [12, 15, 18],
                "lead_time_periods": 2,
                "safety_periods": 1,
            },
        )

    @task(1)
    def rank(self):
        self.client.post(
            "/v1/optimization/rank",
            name="/v1/optimization/rank",
            headers={"Authorization": f"Bearer {os.environ['DAWA_LOAD_TOKEN']}"},
            json={
                "synthetic_attested": True,
                "budget": 100,
                "candidates": [
                    {"id": "synthetic-a", "cost": 30, "benefit": 2},
                    {"id": "synthetic-b", "cost": 50, "benefit": 3},
                ],
            },
        )
