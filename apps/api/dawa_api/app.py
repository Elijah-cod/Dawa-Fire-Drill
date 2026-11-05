"""ASGI entry point for the foundation API."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from dawa_api.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the API and validate required configuration at startup."""
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if settings is None:
            Settings()
        yield

    app = FastAPI(
        title="Dawa Fire Drill API",
        description=(
            "All data is synthetic, calibrated to public aggregates. "
            "Model outputs are illustrative and unvalidated."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "data_policy": "synthetic data; model outputs illustrative and unvalidated",
        }

    return app


app = create_app()
