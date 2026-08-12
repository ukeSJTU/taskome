from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import structlog

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
    if app.state.settings.environment is not Environment.TEST and (
        not await database.is_available()
        or (
            app.state.settings.environment is Environment.PRODUCTION
            and not await database.is_at_head()
        )
    ):
        logger.error("database_startup_failed")
        await database.dispose()
        await app.state.observability.shutdown()
        raise RuntimeError("database startup validation failed")  # noqa: TRY003, EM101
    app.state.ready = True
    logger.info(
        "application_started",
        environment=app.state.settings.environment,
        version=app.state.settings.app_version,
    )
    try:
        yield
    finally:
        app.state.ready = False
        logger.info("application_stopped")
        await database.dispose()
        await app.state.observability.shutdown()
