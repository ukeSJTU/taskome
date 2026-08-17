"""Application lifespan ownership for Gateway process resources."""

from __future__ import annotations

import asyncio
from contextlib import AsyncExitStack, asynccontextmanager
from typing import TYPE_CHECKING, cast

import httpx2
import structlog
from redis.asyncio import Redis
from redis.exceptions import RedisError

from gateway.api.mcp import register_task_tools
from gateway.core.config import Environment
from gateway.core.logging import configure_logging
from gateway.core.observability import create_observability
from gateway.services.task_manifests import fetch_task_manifests

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Awaitable

    from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Own construction and teardown of every Gateway process resource.

    Args:
        app: Gateway application whose state carries factories and test seams.

    Yields:
        Control while the application is ready to serve requests.
    """

    settings = app.state.settings
    observability = create_observability(
        settings,
        span_exporter=app.state.span_exporter,
        log_exporter=app.state.log_exporter,
    )
    app.state.observability = observability
    configure_logging(
        settings,
        observability.logger_provider,
    )
    logger = structlog.get_logger()
    database = app.state.database
    async with AsyncExitStack() as resources:
        resources.push_async_callback(observability.shutdown)
        resources.push_async_callback(database.dispose)
        resources.push_async_callback(app.state.personal_api_key_verifier.aclose)
        resources.push_async_callback(app.state.dispatch_http_client.aclose)
        resources.push_async_callback(app.state.job_queue.aclose)

        try:
            if hasattr(database, "start"):
                database.start(tracer_provider=observability.tracer_provider)
            storage = app.state.storage or app.state.storage_factory()
            app.state.storage = storage
            app.state.owned_input_file_service.attach_storage(storage)
            resources.push_async_callback(asyncio.to_thread, storage.close)
            storage.start()
            await app.state.job_queue.start()
            redis: Redis = app.state.redis or Redis.from_url(
                settings.redis_url.get_secret_value(),
                socket_connect_timeout=settings.redis_timeout_seconds,
                socket_timeout=settings.redis_timeout_seconds,
            )
            app.state.redis = redis
            resources.push_async_callback(redis.aclose)
            jwks_http_client = httpx2.AsyncClient(
                timeout=httpx2.Timeout(settings.jwks_timeout_seconds)
            )
            resources.push_async_callback(jwks_http_client.aclose)
            for verifier in app.state.managed_token_verifiers:
                verifier.start(jwks_http_client)

            if settings.app_environment is not Environment.TEST:
                manifests = await fetch_task_manifests(
                    settings.task_servers, app.state.dispatch_http_client
                )
                app.state.owned_job_service.attach_manifests(manifests)
                register_task_tools(app.state.mcp, app.state.owned_job_service, manifests)
            if settings.app_environment is not Environment.TEST and (
                not await database.is_available()
                or (
                    settings.app_environment is Environment.PRODUCTION
                    and not await database.is_at_head()
                )
            ):
                logger.error("database_startup_failed")
                raise RuntimeError("database startup validation failed")  # noqa: TRY003, EM101
            try:
                async with asyncio.timeout(settings.redis_timeout_seconds):
                    await cast("Awaitable[bool]", redis.ping())
            except RedisError, TimeoutError:
                logger.exception("redis_startup_failed")
                raise RuntimeError("Redis startup validation failed") from None  # noqa: TRY003, EM101

            app.state.ready = True
            logger.info(
                "application_started",
                environment=settings.app_environment,
                version=settings.app_version,
            )
            yield
        finally:
            app.state.ready = False
            logger.info("application_stopped")
