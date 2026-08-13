from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastmcp.utilities.lifespan import combine_lifespans
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from redis.asyncio import Redis
from scalar_fastapi import get_scalar_api_reference

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
from gateway.core.rate_limit import create_rate_limit_store
from gateway.db.database import Database
from gateway.repositories.input_files import InputFileRepository
from gateway.schemas.problem import ProblemDetails
from gateway.services.input_files import InputFileService
from gateway.services.storage import SeaweedFSStorage

if TYPE_CHECKING:
    from fastapi.responses import HTMLResponse
    from fastmcp.server.auth import TokenVerifier
    from opentelemetry.sdk._logs.export import LogRecordExporter
    from opentelemetry.sdk.trace.export import SpanExporter


def create_app(  # noqa: PLR0913
    settings: Settings | None = None,
    *,
    database: Database | None = None,
    span_exporter: SpanExporter | None = None,
    log_exporter: LogRecordExporter | None = None,
    token_verifier: TokenVerifier | None = None,
    rate_limit_redis: Redis | None = None,
) -> FastAPI:
    app_settings = settings or Settings()
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
    app_rate_limit_redis = rate_limit_redis or Redis.from_url(
        app_settings.rate_limit_redis_url.get_secret_value()
    )
    rate_limit_store = create_rate_limit_store(app_settings.rate_limit_redis_url.get_secret_value())
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
        auth_provider=None if app_settings.app_environment is Environment.TEST else verifier,
    )
    mcp_app = mcp_server.http_app(path="/")

    application = FastAPI(
        title=app_settings.app_name,
        version=app_settings.app_version,
        docs_url=None,
        redoc_url=None,
        openapi_url=openapi_url,
        lifespan=combine_lifespans(lifespan, mcp_app.lifespan),
    )
    application.state.settings = app_settings
    application.state.database = app_database
    application.state.rate_limit_redis = app_rate_limit_redis
    application.state.rate_limit_store = rate_limit_store
    application.state.input_file_service = input_file_service
    application.state.token_verifier = verifier
    application.state.mcp = mcp_server
    application.state.observability = observability
    register_error_handlers(application)
    application.include_router(health_router)
    application.include_router(api_v1_router)
    application.include_router(auth_api_router)
    application.mount("/mcp", mcp_app)
    if app_settings.expose_docs:
        _add_scalar_api_reference(application)
    application.add_middleware(AccessLoggingMiddleware)
    application.add_middleware(
        MCPAuthenticationMiddleware,
        verifier=verifier,
    )
    application.add_middleware(RequestIDMiddleware)
    application.add_middleware(
        SecurityHeadersMiddleware,
        include_hsts=app_settings.app_environment is Environment.PRODUCTION,
    )
    FastAPIInstrumentor.instrument_app(
        application,
        tracer_provider=observability.tracer_provider,
    )
    _configure_openapi(application)
    return application


def _add_scalar_api_reference(application: FastAPI) -> None:
    @application.get("/scalar", include_in_schema=False)
    async def scalar_api_reference() -> HTMLResponse:
        return get_scalar_api_reference(
            openapi_url=application.openapi_url,
            title=f"{application.title} API Reference",
            telemetry=False,
        )


def _configure_openapi(application: FastAPI) -> None:
    def openapi() -> dict[str, object]:
        if application.openapi_schema is not None:
            return application.openapi_schema

        schema = get_openapi(
            title=application.title,
            version=application.version,
            routes=application.routes,
        )
        problem_schema = ProblemDetails.model_json_schema(
            ref_template="#/components/schemas/{model}"
        )
        component_schemas = schema.setdefault("components", {}).setdefault("schemas", {})
        component_schemas.update(problem_schema.pop("$defs", {}))
        component_schemas["ProblemDetails"] = problem_schema
        application.openapi_schema = schema
        return schema

    # FastAPI invokes an instance-assigned OpenAPI callable without passing self.
    application.openapi = cast("Any", openapi)


app = create_app()
