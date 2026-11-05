"""ASGI entry point for the foundation API."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from dawa_api.jobs.router import router as jobs_router
from dawa_api.optimization.router import router as optimization_router
from dawa_api.scenarios.router import router as scenario_router
from dawa_api.settings import Settings


def create_app(settings: Settings | None = None, engine: AsyncEngine | None = None) -> FastAPI:
    """Build the API and validate required configuration at startup."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        resolved = settings or Settings()
        database = engine or create_async_engine(resolved.database_url)
        app.state.settings = resolved
        app.state.sessions = async_sessionmaker(database, expire_on_commit=False)
        try:
            yield
        finally:
            if engine is None:
                await database.dispose()

    app = FastAPI(
        title="Dawa Fire Drill API",
        description=(
            "All data is synthetic, calibrated to public aggregates. "
            "Model outputs are illustrative and unvalidated."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(scenario_router, prefix=settings.api_prefix if settings else "/v1")
    app.include_router(jobs_router, prefix=settings.api_prefix if settings else "/v1")
    app.include_router(optimization_router, prefix=settings.api_prefix if settings else "/v1")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "data_policy": "synthetic data; model outputs illustrative and unvalidated",
        }

    return app


app = create_app()
