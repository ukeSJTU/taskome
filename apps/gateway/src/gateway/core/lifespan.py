from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import structlog

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
    app.state.ready = True
    logger = structlog.get_logger()
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
        await app.state.observability.shutdown()
