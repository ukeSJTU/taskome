from __future__ import annotations

import argparse
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.util.exc import CommandError
from gateway.core.config import Settings

GATEWAY_ROOT = Path(__file__).resolve().parents[1]


def config(database_url: str) -> Config:
    alembic_config = Config(str(GATEWAY_ROOT / "alembic.ini"))
    alembic_config.set_main_option("sqlalchemy.url", database_url)
    return alembic_config


def migrate(database_url: str) -> None:
    command.upgrade(config(database_url), "head")


def revision() -> bool:
    from testcontainers.postgres import PostgresContainer  # noqa: PLC0415

    with PostgresContainer("postgres:18") as postgres:
        database_url = postgres.get_connection_url().replace(
            "postgresql+psycopg2", "postgresql+psycopg"
        )
        migrate(database_url)
        try:
            command.check(config(database_url))
        except CommandError as error:
            if "New upgrade operations detected" in str(error):
                command.revision(config(database_url), autogenerate=True, message="describe change")
                return True
            raise
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Gateway database commands")
    parser.add_argument("operation", choices=("revision", "migrate"))
    args = parser.parse_args()
    settings = Settings()
    if args.operation == "revision":
        revision()
        return
    migrate(settings.database_url.get_secret_value())


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - command output must not reveal connection details.
        print(f"gateway database command failed: {type(error).__name__}", file=sys.stderr)  # noqa: T201
        raise SystemExit(1) from None
