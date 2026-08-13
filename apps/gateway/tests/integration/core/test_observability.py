from __future__ import annotations

import asyncio

from gateway.db.database import Database
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from testcontainers.postgres import PostgresContainer


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
        statement_spans = [
            span for span in spans if span.attributes and "db.statement" in span.attributes
        ]
        assert statement_spans
        for span in statement_spans:
            attributes = span.attributes or {}
            assert not any(
                key in attributes
                for key in ("db.url", "db.password", "db.bindings", "db.parameters")
            )
            assert "test-secret" not in str(attributes)
        asyncio.run(database.dispose())


async def _create_gateway_schema(database_url: str) -> None:
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("CREATE SCHEMA gateway"))
    finally:
        await engine.dispose()
