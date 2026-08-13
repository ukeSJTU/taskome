from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import pytest
from gateway.db.database import Database
from gateway.models import metadata
from scripts.database import migrate
from testcontainers.postgres import PostgresContainer

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    """One Postgres container for the whole integration run, schema built by running
    real `alembic upgrade head` — see ADR-0024 for why tests use the migration chain
    instead of building the schema ad hoc."""
    with PostgresContainer("postgres:18") as postgres:
        database_url = postgres.get_connection_url().replace(
            "postgresql+psycopg2", "postgresql+psycopg"
        )
        migrate(database_url)
        yield database_url


@pytest.fixture(scope="session")
def _database(postgres_url: str) -> Iterator[Database]:
    database = Database(postgres_url)
    yield database
    asyncio.run(database.dispose())


@pytest.fixture
async def database(_database: Database) -> Database:
    """The session-scoped `Database`, with every Gateway-owned table cleared before
    each test so tests don't see one another's rows."""
    async with _database.transaction() as session:
        for table in reversed(metadata.sorted_tables):
            await session.execute(table.delete())
    return _database
