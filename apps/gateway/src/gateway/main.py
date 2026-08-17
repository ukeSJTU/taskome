"""Gateway application assembly without allocating process I/O resources."""

from __future__ import annotations

from functools import partial
from typing import TYPE_CHECKING, Any, cast

import httpx
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastmcp.utilities.lifespan import combine_lifespans
from scalar_fastapi import get_scalar_api_reference

from gateway.api.health import router as health_router
from gateway.api.internal import router as internal_router
from gateway.api.mcp import create_mcp_server
from gateway.api.v1.router import router as api_v1_router
from gateway.core.auth import (
    ManagedJWTVerifier,
    MCPPrincipalVerifier,
    RESTPrincipalVerifier,
    create_mcp_auth_provider,
    create_mcp_token_verifier,
    create_rest_auth_provider,
    create_rest_token_verifier,
)
from gateway.core.config import Environment, Settings
from gateway.core.errors import register_error_handlers
from gateway.core.lifespan import lifespan
from gateway.core.middleware import (
    AccessLoggingMiddleware,
    MCPAuthRequestIDMiddleware,
    RequestBodyLimitMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from gateway.core.observability import DeferredTelemetryMiddleware
from gateway.core.personal_api_keys import PersonalApiKeyVerifier, WebPersonalApiKeyVerifier
from gateway.db.database import Database
from gateway.repositories.input_files import InputFileRepository
from gateway.repositories.jobs import JobRepository
from gateway.schemas.problem import ProblemDetails
from gateway.services.input_files import InputFileService
from gateway.services.job_outputs import JobOutputService
from gateway.services.job_queue import TaskiqJobQueue
from gateway.services.jobs import JobQueuePort, JobService
from gateway.services.storage import SeaweedFSStorage

if TYPE_CHECKING:
    from fastapi.responses import HTMLResponse
    from fastmcp.server.auth import TokenVerifier
    from opentelemetry.sdk._logs.export import LogRecordExporter
    from opentelemetry.sdk.trace.export import SpanExporter
    from redis.asyncio import Redis


def create_app(  # noqa: PLR0913, PLR0915
    settings: Settings | None = None,
    *,
    database: Database | None = None,
    span_exporter: SpanExporter | None = None,
    log_exporter: LogRecordExporter | None = None,
    rest_token_verifier: TokenVerifier | None = None,
    mcp_token_verifier: TokenVerifier | None = None,
    redis: Redis | None = None,
    storage: SeaweedFSStorage | None = None,
    personal_api_key_verifier: PersonalApiKeyVerifier | None = None,
    dispatch_http_client: httpx.AsyncClient | None = None,
    job_queue: JobQueuePort | None = None,
) -> FastAPI:
    """Assemble an app whose external resources are allocated by lifespan.

    Args:
        settings: Optional validated runtime configuration.
        database: Optional database seam for tests.
        span_exporter: Optional trace exporter seam for tests.
        log_exporter: Optional log exporter seam for tests.
        rest_token_verifier: Optional REST authentication seam.
        mcp_token_verifier: Optional MCP authentication seam.
        redis: Optional Redis seam for tests.
        storage: Optional object-storage seam for tests.
        personal_api_key_verifier: Optional Personal API Key verification seam.
        dispatch_http_client: Optional Task Server dispatch HTTP seam for tests.

    Returns:
        A fully routed FastAPI application ready for lifespan startup.
    """

    app_settings = settings or Settings()
    openapi_url = "/openapi.json" if app_settings.expose_docs else None
    app_database = database or Database(
        app_settings.database_url.get_secret_value(),
        timeout_seconds=app_settings.database_timeout_seconds,
        defer_start=True,
    )
    app_redis = redis
    rest_verifier = rest_token_verifier or create_rest_token_verifier(app_settings)
    mcp_verifier = (
        MCPPrincipalVerifier(mcp_token_verifier)
        if mcp_token_verifier is not None
        else create_mcp_token_verifier(app_settings)
    )
    rest_auth_provider = create_rest_auth_provider(app_settings, rest_verifier)
    mcp_auth_provider = create_mcp_auth_provider(app_settings, mcp_verifier)
    api_key_verifier = personal_api_key_verifier or WebPersonalApiKeyVerifier(
        url=app_settings.personal_api_key_verification_url,
        secret=app_settings.web_gateway_hmac_secret.get_secret_value(),
    )
    storage_factory = partial(
        SeaweedFSStorage,
        internal_endpoint=app_settings.seaweedfs_internal_endpoint,
        public_endpoint=app_settings.resolved_seaweedfs_public_endpoint,
        task_endpoint=app_settings.resolved_seaweedfs_task_endpoint,
        access_key=app_settings.seaweedfs_access_key,
        secret_key=app_settings.seaweedfs_secret_key.get_secret_value(),
        bucket=app_settings.seaweedfs_bucket,
        connect_timeout=app_settings.seaweedfs_connect_timeout_seconds,
        io_timeout=app_settings.seaweedfs_io_timeout_seconds,
    )
    input_file_service = InputFileService(
        repository=InputFileRepository(app_database),
        storage=storage,
    )
    dispatch_client = dispatch_http_client or httpx.AsyncClient(
        timeout=httpx.Timeout(30, connect=5)
    )
    queue = job_queue or TaskiqJobQueue(app_settings.redis_url.get_secret_value())
    job_service = JobService(
        repository=JobRepository(app_database),
        input_files=InputFileRepository(app_database),
        queue=queue,
        manifests={},
    )
    job_output_service = JobOutputService(repository=JobRepository(app_database), storage=storage)
    mcp_server = create_mcp_server(
        app_settings,
        input_file_service,
        job_service=job_service,
        auth_provider=mcp_auth_provider,
    )
    mcp_protocol_app = mcp_server.http_app(path="/")
    mcp_app = MCPAuthRequestIDMiddleware(
        RequestBodyLimitMiddleware(
            mcp_protocol_app,
            max_body_size=app_settings.mcp_message_max_bytes,
        )
    )

    application = FastAPI(
        title=app_settings.app_name,
        version=app_settings.app_version,
        docs_url=None,
        redoc_url=None,
        openapi_url=openapi_url,
        lifespan=combine_lifespans(lifespan, mcp_protocol_app.lifespan),
    )
    application.state.settings = app_settings
    application.state.database = app_database
    application.state.redis = app_redis
    application.state.storage = storage
    application.state.storage_factory = storage_factory
    application.state.input_file_service = input_file_service
    application.state.owned_input_file_service = input_file_service
    application.state.job_service = job_service
    application.state.owned_job_service = job_service
    application.state.job_output_service = job_output_service
    application.state.owned_job_output_service = job_output_service
    application.state.job_queue = queue
    application.state.dispatch_http_client = dispatch_client
    application.state.rest_token_verifier = rest_verifier
    application.state.personal_api_key_verifier = api_key_verifier
    application.state.public_openapi_schema = None
    application.state.mcp = mcp_server
    application.state.span_exporter = span_exporter
    application.state.log_exporter = log_exporter
    rest_managed_verifiers = (
        (rest_verifier.session_verifier, rest_verifier.oauth_verifier)
        if isinstance(rest_verifier, RESTPrincipalVerifier)
        else (rest_verifier,)
    )
    application.state.managed_token_verifiers = tuple(
        verifier
        for verifier in (*rest_managed_verifiers, mcp_verifier.token_verifier)
        if isinstance(verifier, ManagedJWTVerifier)
    )
    register_error_handlers(application)
    application.include_router(health_router)
    application.include_router(api_v1_router)
    application.include_router(internal_router)
    application.router.routes.extend(rest_auth_provider.get_routes("/v1"))
    application.router.routes.extend(mcp_auth_provider.get_routes("/mcp"))

    application.mount("/mcp", mcp_app)
    if app_settings.expose_docs:
        _add_scalar_api_reference(application)
    application.add_middleware(
        RequestBodyLimitMiddleware,
        max_body_size=app_settings.request_body_max_bytes,
    )
    application.add_middleware(AccessLoggingMiddleware)
    application.add_middleware(RequestIDMiddleware)
    application.add_middleware(
        SecurityHeadersMiddleware,
        include_hsts=app_settings.app_environment is Environment.PRODUCTION,
    )
    application.add_middleware(
        DeferredTelemetryMiddleware,
        application=application,
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
