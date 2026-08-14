"""Structured Task Server logging configuration."""

from __future__ import annotations

import logging
import sys
from typing import TYPE_CHECKING

import structlog
from opentelemetry.instrumentation.logging.handler import LoggingHandler

from ._settings import Environment, TaskServerSettings

if TYPE_CHECKING:
    from opentelemetry.sdk._logs import LoggerProvider


def configure_logging(settings: TaskServerSettings, logger_provider: LoggerProvider) -> None:
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    renderer: structlog.types.Processor
    if settings.app_environment is Environment.DEVELOPMENT:
        renderer = structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty())
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
        foreign_pre_chain=shared_processors,
    )
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    telemetry = LoggingHandler(logger_provider=logger_provider)
    telemetry.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(console)
    root.addHandler(telemetry)
    root.setLevel(settings.log_level.value.upper())
    for logger_name in (
        "boto3",
        "botocore",
        "fastmcp",
        "httpcore",
        "httpx",
        "httpx2",
        "opentelemetry.instrumentation.logging.handler.internal",
        "urllib3",
        "uvicorn.access",
    ):
        logging.getLogger(logger_name).setLevel(logging.ERROR)
