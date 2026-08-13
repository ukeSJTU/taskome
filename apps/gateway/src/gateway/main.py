from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import FastAPI
from fastmcp.utilities.lifespan import combine_lifespans
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from gateway.api.health import router as health_router
from gateway.api.mcp import create_mcp_server
from gateway.api.v1.router import auth_api_router
from gateway.api.v1.router import router as api_v1_router
from gateway.core.auth import create_token_verifier
from gateway.core.config import Environment, Settings
from gateway.core.errors import register_error_handlers
from gateway.core.lifespan import lifespan
from gateway.core.middleware import (
    AccessLoggingMiddleware,
    MCPAuthenticationMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from gateway.core.observability import create_observability
from gateway.db.database import Database
from gateway.repositories.input_files import InputFileRepository
from gateway.services.input_files import InputFileService
from gateway.services.storage import SeaweedFSStorage

if TYPE_CHECKING:
    from fastmcp.server.auth import TokenVerifier
    from opentelemetry.sdk._logs.export import LogRecordExporter
    from opentelemetry.sdk.trace.export import SpanExporter


def create_app(
    settings: Settings | None = None,
    *,
    database: Database | None = None,
    span_exporter: SpanExporter | None = None,
    log_exporter: LogRecordExporter | None = None,
    token_verifier: TokenVerifier | None = None,
) -> FastAPI:
    app_settings = settings or Settings()
    docs_url = "/docs" if app_settings.expose_docs else None
    openapi_url = "/openapi.json" if app_settings.expose_docs else None
    observability = create_observability(
        app_settings,
        span_exporter=span_exporter,
        log_exporter=log_exporter,
    )
    app_database = database or Database(
        app_settings.database_url.get_secret_value(),
        tracer_provider=observability.tracer_provider,
    )
    verifier = token_verifier or create_token_verifier(app_settings)
    input_file_service = InputFileService(
        repository=InputFileRepository(app_database),
        storage=SeaweedFSStorage(
            internal_endpoint=app_settings.seaweedfs_internal_endpoint,
            public_endpoint=app_settings.resolved_seaweedfs_public_endpoint,
            access_key=app_settings.seaweedfs_access_key,
            secret_key=app_settings.seaweedfs_secret_key.get_secret_value(),
            bucket=app_settings.seaweedfs_bucket,
        ),
    )
    mcp_server = create_mcp_server(
        app_settings,
        input_file_service,
        auth_provider=None if app_settings.environment is Environment.TEST else verifier,
    )
    mcp_app = mcp_server.http_app(path="/")

    application = FastAPI(
        title=app_settings.app_name,
        version=app_settings.app_version,
        docs_url=docs_url,
        redoc_url="/redoc" if app_settings.expose_docs else None,
        openapi_url=openapi_url,
        lifespan=combine_lifespans(lifespan, mcp_app.lifespan),
    )
    application.state.settings = app_settings
    application.state.database = app_database
    application.state.input_file_service = input_file_service
    application.state.token_verifier = verifier
    application.state.mcp = mcp_server
    application.state.observability = observability
    register_error_handlers(application)
    application.include_router(health_router)
    application.include_router(api_v1_router)
    application.include_router(auth_api_router)
    application.mount("/mcp", mcp_app)
    application.add_middleware(AccessLoggingMiddleware)
    application.add_middleware(
        MCPAuthenticationMiddleware,
        verifier=verifier,
    )
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
