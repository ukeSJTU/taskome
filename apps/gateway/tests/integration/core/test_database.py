"""Database dependency budgets against the real Postgres integration seam."""

from gateway.db.database import Database


async def test_migration_head_check_obeys_total_timeout(postgres_url: str) -> None:
    database = Database(postgres_url, timeout_seconds=1e-9)

    try:
        assert not await database.is_at_head()
    finally:
        await database.dispose()
