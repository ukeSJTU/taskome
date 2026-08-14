"""OpenTelemetry provider construction and bounded process shutdown."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from functools import partial
from threading import Thread
from time import monotonic
from typing import TYPE_CHECKING, Any, Literal

from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from opentelemetry.instrumentation.fastapi import _get_default_span_details
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import (
    BatchLogRecordProcessor,
    LogRecordExporter,
    SimpleLogRecordProcessor,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor, SpanExporter
from opentelemetry.util.re import parse_env_headers

if TYPE_CHECKING:
    from collections.abc import Callable

    from starlette.types import ASGIApp, Receive, Scope, Send

    from gateway.core.config import Settings


class DeferredTelemetryMiddleware:
    """Create OTel's request middleware after lifespan has created its providers."""

    def __init__(self, app: ASGIApp, *, application: Any) -> None:  # noqa: ANN401
        self.app = app
        self.application = application
        self._otel: OpenTelemetryMiddleware | None = None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "lifespan":
            await self.app(scope, receive, send)
            return
        if self._otel is None:
            self._otel = OpenTelemetryMiddleware(
                self.app,
                tracer_provider=self.application.state.observability.tracer_provider,
                default_span_details=_get_default_span_details,
            )
        await self._otel(scope, receive, send)


@dataclass
class Observability:
    """Process-owned trace and log providers with a shared flush budget."""

    tracer_provider: TracerProvider
    logger_provider: LoggerProvider

    shutdown_timeout_seconds: float = 5

    async def shutdown(self) -> None:
        """Flush logs and traces without allowing shutdown to hang indefinitely."""

        deadline = monotonic() + self.shutdown_timeout_seconds
        timeout_millis = int(self.shutdown_timeout_seconds * 1000)
        await asyncio.to_thread(
            _run_with_deadline,
            (
                partial(self.logger_provider.force_flush, timeout_millis),
                partial(self.tracer_provider.force_flush, timeout_millis),
            ),
            deadline,
        )
        await asyncio.to_thread(
            _run_with_deadline,
            (self.logger_provider.shutdown, self.tracer_provider.shutdown),
            deadline,
        )


def _run_with_deadline(callbacks: tuple[Callable[[], object], ...], deadline: float) -> None:
    """Run blocking OTel teardown calls without keeping process exit alive."""

    threads = [Thread(target=callback, daemon=True) for callback in callbacks]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(max(0, deadline - monotonic()))


type OtelSignal = Literal["traces", "logs"]


def _otlp_endpoint(settings: Settings, signal: OtelSignal) -> str | None:
    signal_endpoint = getattr(settings, f"otel_exporter_otlp_{signal}_endpoint")
    if signal_endpoint is not None:
        return signal_endpoint
    if settings.otel_exporter_otlp_endpoint is None:
        return None
    return f"{settings.otel_exporter_otlp_endpoint.rstrip('/')}/v1/{signal}"


def _otlp_headers(settings: Settings, signal: OtelSignal) -> dict[str, str] | None:
    raw_headers = (
        getattr(settings, f"otel_exporter_otlp_{signal}_headers")
        or settings.otel_exporter_otlp_headers
    )
    return dict(parse_env_headers(raw_headers)) if raw_headers else None


def create_observability(
    settings: Settings,
    *,
    span_exporter: SpanExporter | None = None,
    log_exporter: LogRecordExporter | None = None,
) -> Observability:
    """Build process-local OTel providers from Gateway settings.

    Args:
        settings: Validated exporter endpoints, headers, and shutdown budget.
        span_exporter: Optional test or in-process trace exporter.
        log_exporter: Optional test or in-process log exporter.

    Returns:
        The process-owned tracing and logging providers.
    """

    resource = Resource.create(
        {
            "service.name": settings.otel_service_name or settings.app_name,
            "service.version": settings.app_version,
            "deployment.environment.name": settings.app_environment,
        },
    )
    tracer_provider = TracerProvider(resource=resource)
    logger_provider = LoggerProvider(resource=resource)

    if span_exporter is not None:
        tracer_provider.add_span_processor(SimpleSpanProcessor(span_exporter))
    elif traces_endpoint := _otlp_endpoint(settings, "traces"):
        tracer_provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(
                    endpoint=traces_endpoint,
                    headers=_otlp_headers(settings, "traces"),
                    timeout=settings.otel_shutdown_timeout_seconds,
                ),
            ),
        )

    if log_exporter is not None:
        logger_provider.add_log_record_processor(SimpleLogRecordProcessor(log_exporter))
    elif logs_endpoint := _otlp_endpoint(settings, "logs"):
        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(
                OTLPLogExporter(
                    endpoint=logs_endpoint,
                    headers=_otlp_headers(settings, "logs"),
                    timeout=settings.otel_shutdown_timeout_seconds,
                ),
            ),
        )

    return Observability(
        tracer_provider=tracer_provider,
        logger_provider=logger_provider,
        shutdown_timeout_seconds=settings.otel_shutdown_timeout_seconds,
    )
