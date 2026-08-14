"""Bounded async Postgres engine and transaction ownership."""

from __future__ import annotations

from asyncio import timeout
from contextlib import asynccontextmanager
from pathlib import Path
from typing import TYPE_CHECKING

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.utils import suppress_instrumentation
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from gateway.db.base import GATEWAY_SCHEMA

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from opentelemetry.sdk.trace import TracerProvider
    from sqlalchemy.ext.asyncio import AsyncSession

ALEMBIC_CONFIG_PATH = Path(__file__).resolve().parents[3] / "alembic.ini"


class Database:
    """Own the Gateway Postgres engine, pool, and bounded transactions."""

    def __init__(
        self,
        database_url: str,
        *,
        tracer_provider: TracerProvider | None = None,
        timeout_seconds: float = 5,
        defer_start: bool = False,
    ) -> None:
        """Create a bounded Postgres pool.

        Args:
            database_url: SQLAlchemy URL for Gateway's Postgres database.
            tracer_provider: Optional OpenTelemetry provider for SQL spans.
            timeout_seconds: Combined transaction budget and pool-acquisition ceiling.
        """

        self._database_url = database_url
        self._tracer_provider = tracer_provider
        self._timeout_seconds = timeout_seconds
        self._engine: AsyncEngine | None = None
        self._sessions: async_sessionmaker[AsyncSession] | None = None
        if not defer_start:
            self.start(tracer_provider=tracer_provider)

    def start(self, *, tracer_provider: TracerProvider | None = None) -> None:
        """Construct and instrument the connection pool during app startup.

        Args:
            tracer_provider: Process-owned provider used for SQL spans.
        """

        if self._engine is not None:
            return
        self._engine = create_async_engine(
            self._database_url,
            echo=False,
            max_overflow=5,
            pool_pre_ping=True,
            pool_size=5,
            pool_timeout=self._timeout_seconds,
            connect_args={
                "connect_timeout": max(1, int(self._timeout_seconds)),
                "options": f"-c statement_timeout={int(self._timeout_seconds * 1000)}",
            },
        )
        active_tracer_provider = tracer_provider or self._tracer_provider
        if active_tracer_provider is not None:
            SQLAlchemyInstrumentor().instrument(
                engine=self._engine.sync_engine,
                tracer_provider=active_tracer_provider,
                enable_commenter=False,
                enable_attribute_commenter=False,
            )
        self._sessions = async_sessionmaker(self._engine, expire_on_commit=False)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[AsyncSession]:
        """Run one short transaction within the configured total timeout budget.

        Yields:
            A session whose transaction commits when the context exits.

        Raises:
            RuntimeError: If called outside the application lifespan.
            TimeoutError: If acquisition and statements exceed the shared budget.
        """

        if self._sessions is None:
            raise RuntimeError("database used outside the application lifespan")  # noqa: TRY003, EM101
        async with timeout(self._timeout_seconds):
            async with self._sessions.begin() as session:
                yield session

    async def is_available(self) -> bool:
        """Return whether Postgres and the Gateway schema are reachable.

        Returns:
            True when a connection succeeds and the owned schema exists.
        """

        if self._engine is None:
            return False
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
        """Close every pooled Postgres connection."""

        if self._engine is not None:
            await self._engine.dispose()
            self._engine = None
            self._sessions = None

    async def is_at_head(self) -> bool:
        """Check the Alembic head within the total Postgres timeout budget.

        Returns:
            True when every applied migration head matches the checked-in heads.
        """

        if self._engine is None:
            return False
        config = Config(str(ALEMBIC_CONFIG_PATH))
        expected = set(ScriptDirectory.from_config(config).get_heads())
        with suppress_instrumentation():
            try:
                async with timeout(self._timeout_seconds):
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
