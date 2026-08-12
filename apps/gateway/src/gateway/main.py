from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import FastAPI
from fastmcp.utilities.lifespan import combine_lifespans
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from gateway.api.health import router as health_router
from gateway.api.mcp import create_mcp_server
from gateway.api.v1.router import router as api_v1_router
from gateway.core.config import Environment, Settings
from gateway.core.errors import register_error_handlers
from gateway.core.lifespan import lifespan
from gateway.core.middleware import (
    AccessLoggingMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from gateway.core.observability import create_observability
from gateway.db.database import Database

if TYPE_CHECKING:
    from opentelemetry.sdk._logs.export import LogRecordExporter
    from opentelemetry.sdk.trace.export import SpanExporter


def create_app(
    settings: Settings | None = None,
    *,
    database: Database | None = None,
    span_exporter: SpanExporter | None = None,
    log_exporter: LogRecordExporter | None = None,
) -> FastAPI:
    app_settings = settings or Settings()
    docs_url = "/docs" if app_settings.expose_docs else None
    openapi_url = "/openapi.json" if app_settings.expose_docs else None
    mcp_server = create_mcp_server(app_settings)
    mcp_app = mcp_server.http_app(path="/")
    observability = create_observability(
        app_settings,
        span_exporter=span_exporter,
        log_exporter=log_exporter,
    )

    application = FastAPI(
        title=app_settings.app_name,
        version=app_settings.app_version,
        docs_url=docs_url,
        redoc_url="/redoc" if app_settings.expose_docs else None,
        openapi_url=openapi_url,
        lifespan=combine_lifespans(lifespan, mcp_app.lifespan),
    )
    application.state.settings = app_settings
    application.state.database = database or Database(app_settings.database_url.get_secret_value())
    application.state.mcp = mcp_server
    application.state.observability = observability
    register_error_handlers(application)
    application.include_router(health_router)
    application.include_router(api_v1_router)
    application.mount("/mcp", mcp_app)
    application.add_middleware(AccessLoggingMiddleware)
    application.add_middleware(RequestIDMiddleware)
    application.add_middleware(
        SecurityHeadersMiddleware,
        include_hsts=app_settings.environment is Environment.PRODUCTION,
    )
    FastAPIInstrumentor.instrument_app(
        application,
        tracer_provider=observability.tracer_provider,
    )
    return application


app = create_app()
