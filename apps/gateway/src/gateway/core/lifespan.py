from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import structlog
from redis.exceptions import RedisError

from gateway.core.config import Environment
from gateway.core.logging import configure_logging

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging(
        app.state.settings,
        app.state.observability.logger_provider,
    )
    logger = structlog.get_logger()
    database = app.state.database
    rate_limit_redis = app.state.rate_limit_redis
    if app.state.settings.app_environment is not Environment.TEST and (
        not await database.is_available()
        or (
            app.state.settings.app_environment is Environment.PRODUCTION
            and not await database.is_at_head()
        )
    ):
        logger.error("database_startup_failed")
        await rate_limit_redis.aclose()
        await app.state.personal_api_key_verifier.aclose()
        await database.dispose()
        await app.state.observability.shutdown()
        raise RuntimeError("database startup validation failed")  # noqa: TRY003, EM101
    try:
        async with asyncio.timeout(2):
            await rate_limit_redis.ping()
    except RedisError, TimeoutError:
        logger.exception("redis_startup_failed")
        await rate_limit_redis.aclose()
        await app.state.personal_api_key_verifier.aclose()
        await database.dispose()
        await app.state.observability.shutdown()
        raise RuntimeError("Redis startup validation failed") from None  # noqa: TRY003, EM101
    app.state.ready = True
    logger.info(
        "application_started",
        environment=app.state.settings.app_environment,
        version=app.state.settings.app_version,
    )
    try:
        yield
    finally:
        app.state.ready = False
        logger.info("application_stopped")
        await rate_limit_redis.aclose()
        await app.state.personal_api_key_verifier.aclose()
        await database.dispose()
        await app.state.observability.shutdown()
