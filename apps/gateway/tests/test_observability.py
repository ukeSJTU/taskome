import asyncio
import json

from fastapi.testclient import TestClient
from gateway.core.config import Environment, Settings
from gateway.db.database import Database
from gateway.main import create_app
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from testcontainers.postgres import PostgresContainer


def test_http_requests_emit_server_spans() -> None:
    exporter = InMemorySpanExporter()
    app = create_app(
        Settings(environment=Environment.TEST),
        span_exporter=exporter,
    )

    with TestClient(app) as client:
        client.get("/health/live")

    server_spans = [span for span in exporter.get_finished_spans() if span.kind.name == "SERVER"]
    assert len(server_spans) == 1
    attributes = server_spans[0].attributes
    assert attributes is not None
    assert attributes["http.route"] == "/health/live"


def test_access_logs_are_exported_through_otel() -> None:
    exporter = InMemoryLogRecordExporter()
    app = create_app(
        Settings(environment=Environment.TEST),
        log_exporter=exporter,
    )

    with TestClient(app) as client:
        client.get("/does-not-exist")

    bodies = [record.log_record.body for record in exporter.get_finished_logs()]
    access_log = next(
        json.loads(body)
        for body in bodies
        if isinstance(body, str) and '"event": "http_request"' in body
    )
    assert access_log["status_code"] == 404


def test_database_readiness_is_suppressed_but_business_queries_are_traced() -> None:
    with PostgresContainer("postgres:18") as postgres:
        database_url = postgres.get_connection_url().replace(
            "postgresql+psycopg2", "postgresql+psycopg"
        )
        asyncio.run(_create_gateway_schema(database_url))
        SQLAlchemyInstrumentor().uninstrument()
        exporter = InMemorySpanExporter()
        tracer_provider = TracerProvider()
        tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
        database = Database(database_url, tracer_provider=tracer_provider)

        assert asyncio.run(database.is_available())
        assert exporter.get_finished_spans() == ()

        async def business_query() -> None:
            async with database.transaction() as session:
                await session.execute(text("SELECT 1"))

        asyncio.run(business_query())
        spans = exporter.get_finished_spans()
        assert spans
        assert any(span.attributes and "db.statement" in span.attributes for span in spans)
        asyncio.run(database.dispose())


async def _create_gateway_schema(database_url: str) -> None:
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("CREATE SCHEMA gateway"))
    finally:
        await engine.dispose()
