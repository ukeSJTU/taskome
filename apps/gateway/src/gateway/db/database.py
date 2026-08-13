from __future__ import annotations

from asyncio import timeout
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from alembic.runtime.migration import MigrationContext
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.utils import suppress_instrumentation
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from gateway.db.migrations import current_heads
from gateway.db.models import GATEWAY_SCHEMA

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from opentelemetry.sdk.trace import TracerProvider
    from sqlalchemy.ext.asyncio import AsyncSession


class Database:
    def __init__(
        self,
        database_url: str,
        *,
        tracer_provider: TracerProvider | None = None,
    ) -> None:
        self._engine = create_async_engine(
            database_url,
            echo=False,
            max_overflow=5,
            pool_pre_ping=True,
            pool_size=5,
            pool_timeout=10,
        )
        if tracer_provider is not None:
            SQLAlchemyInstrumentor().instrument(
                engine=self._engine.sync_engine,
                tracer_provider=tracer_provider,
            )
        self._sessions = async_sessionmaker(self._engine, expire_on_commit=False)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[AsyncSession]:
        async with self._sessions.begin() as session:
            yield session

    async def is_available(self) -> bool:
        with suppress_instrumentation():
            try:
                async with timeout(2):
                    async with self._engine.connect() as connection:
                        await connection.execute(text("SELECT 1"))
                        schema = await connection.execute(
                            text(
                                "SELECT 1 FROM information_schema.schemata "
                                "WHERE schema_name = :schema"
                            ),
                            {"schema": GATEWAY_SCHEMA},
                        )
                        return schema.scalar_one_or_none() == 1
            except Exception:  # noqa: BLE001 - callers deliberately receive no database details.
                return False

    async def dispose(self) -> None:
        await self._engine.dispose()

    async def is_at_head(self) -> bool:
        expected = set(current_heads())
        with suppress_instrumentation():
            try:
                async with self._engine.connect() as connection:
                    actual = await connection.run_sync(
                        lambda sync_connection: MigrationContext.configure(
                            sync_connection,
                            opts={"version_table_schema": GATEWAY_SCHEMA},
                        ).get_current_heads(),
                    )
                    return set(actual) == expected
            except Exception:  # noqa: BLE001
                return False
