from __future__ import annotations

import argparse
import asyncio
import sys

from alembic import command
from alembic.util.exc import CommandError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from gateway.core.config import Environment, Settings
from gateway.db.migrations import config, upgrade
from gateway.db.models import GATEWAY_SCHEMA, metadata


async def push(database_url: str) -> None:
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as connection:
            await connection.execute(text(f"DROP SCHEMA IF EXISTS {GATEWAY_SCHEMA} CASCADE"))
            await connection.execute(text(f"CREATE SCHEMA {GATEWAY_SCHEMA}"))
            await connection.run_sync(metadata.create_all)
    finally:
        await engine.dispose()


def revision() -> bool:
    from testcontainers.postgres import PostgresContainer  # noqa: PLC0415

    with PostgresContainer("postgres:18") as postgres:
        database_url = postgres.get_connection_url().replace(
            "postgresql+psycopg2", "postgresql+psycopg"
        )
        upgrade(database_url)
        try:
            command.check(config(database_url))
        except CommandError as error:
            if "New upgrade operations detected" in str(error):
                command.revision(config(database_url), autogenerate=True, message="describe change")
                return True
            raise
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Gateway database developer commands")
    parser.add_argument("operation", choices=("push", "revision", "migrate"))
    args = parser.parse_args()
    settings = Settings()
    if args.operation == "push":
        if settings.app_environment is not Environment.DEVELOPMENT:
            parser.error("push is available only in the development environment")
        asyncio.run(push(settings.database_url.get_secret_value()))
        return
    if args.operation == "revision":
        revision()
        return
    upgrade(settings.database_url.get_secret_value())


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - command output must not reveal connection details.
        print(f"gateway database command failed: {type(error).__name__}", file=sys.stderr)  # noqa: T201
        raise SystemExit(1) from None
