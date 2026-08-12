from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING

from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
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
    from gateway.core.config import Settings


@dataclass
class Observability:
    tracer_provider: TracerProvider
    logger_provider: LoggerProvider

    async def shutdown(self) -> None:
        await asyncio.to_thread(self.logger_provider.shutdown)
        await asyncio.to_thread(self.tracer_provider.shutdown)


def _otlp_endpoint(settings: Settings, signal: str) -> str | None:
    signal_endpoint = getattr(settings, f"otel_exporter_otlp_{signal}_endpoint")
    if signal_endpoint is not None:
        return signal_endpoint
    if settings.otel_exporter_otlp_endpoint is None:
        return None
    return f"{settings.otel_exporter_otlp_endpoint.rstrip('/')}/v1/{signal}"


def _otlp_headers(settings: Settings, signal: str) -> dict[str, str] | None:
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
    resource = Resource.create(
        {
            "service.name": settings.otel_service_name or settings.app_name,
            "service.version": settings.app_version,
            "deployment.environment.name": settings.environment,
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
                ),
            ),
        )

    return Observability(
        tracer_provider=tracer_provider,
        logger_provider=logger_provider,
    )
