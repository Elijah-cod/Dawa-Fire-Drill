"""ASGI entry point for the foundation API."""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from dawa_api.auth.jwks import JwksCache
from dawa_api.capture.limits import CaptureBodyLimit
from dawa_api.capture.providers import configured_providers
from dawa_api.capture.router import router as capture_router
from dawa_api.catalog.router import router as catalog_router
from dawa_api.explain.providers import configured_explainers
from dawa_api.finance_flow.router import router as funding_router
from dawa_api.forecasting.router import router as forecast_router
from dawa_api.jobs.router import router as jobs_router
from dawa_api.observability import RequestLogging
from dawa_api.optimization.router import router as optimization_router
from dawa_api.optimization.router import run_router as mitigation_router
from dawa_api.redistribution.router import router as redistribution_router
from dawa_api.scenarios.router import router as scenario_router
from dawa_api.settings import Settings


def create_app(settings: Settings | None = None, engine: AsyncEngine | None = None) -> FastAPI:
    """Build the API and validate required configuration at startup."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        resolved = settings or Settings()
        database = engine or create_async_engine(resolved.database_url)
        app.state.settings = resolved
        app.state.jwks_cache = JwksCache()
        app.state.sessions = async_sessionmaker(database, expire_on_commit=False)
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
                app.state.http_client = client
                app.state.capture_providers = configured_providers(client, resolved)
                app.state.explanation_providers = configured_explainers(client, resolved)
                yield
        finally:
            if engine is None:
                await database.dispose()

    app = FastAPI(
        title="Dawa Fire Drill API",
        description=(
            "All data is synthetic; facility mix, lead-time anchors, and tracer demand "
            "proxies use public aggregates. Funding and temporal patterns remain assumptions. "
            "Other quantities are illustrative assumptions. "
            "Model outputs are illustrative and unvalidated."
        ),
        version="0.1.0",
        responses={
            400: {"description": "Malformed request"},
            401: {"description": "Authentication required or invalid"},
            403: {"description": "Insufficient role or scope"},
            429: {"description": "Authenticated request limit exceeded"},
        },
        lifespan=lifespan,
    )
    prefix = settings.api_prefix if settings else os.environ.get("API_PREFIX", "/v1")
    app.include_router(scenario_router, prefix=prefix)
    app.include_router(jobs_router, prefix=prefix)
    app.include_router(optimization_router, prefix=prefix)
    app.include_router(mitigation_router, prefix=prefix)
    app.include_router(capture_router, prefix=prefix)
    app.include_router(catalog_router, prefix=prefix)
    app.include_router(funding_router, prefix=prefix)
    app.include_router(forecast_router, prefix=prefix)
    app.include_router(redistribution_router, prefix=prefix)
    app.add_middleware(CaptureBodyLimit)
    app.add_middleware(RequestLogging)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "data_policy": "synthetic data; model outputs illustrative and unvalidated",
        }

    @app.get("/ready")
    async def ready() -> JSONResponse:
        try:
            async with app.state.sessions() as session:
                await session.execute(text("SELECT 1"))
        except Exception:
            return JSONResponse(
                status_code=503, content={"status": "unavailable", "database": "unavailable"}
            )
        return JSONResponse(content={"status": "ready", "database": "ready"})

    return app


app = create_app()
