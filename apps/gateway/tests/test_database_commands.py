from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from typing import TYPE_CHECKING

import psycopg
import pytest
from alembic import command
from gateway.db.database import Database
from scripts.database import config, revision
from testcontainers.postgres import PostgresContainer

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    with PostgresContainer("postgres:18") as postgres:
        yield postgres.get_connection_url().replace("postgresql+psycopg2", "postgresql+psycopg")


def test_development_push_rebuilds_only_gateway_schema(database_url: str) -> None:
    with psycopg.connect(database_url.replace("+psycopg", ""), autocommit=True) as connection:
        connection.execute("CREATE TABLE public.sentinel (value text NOT NULL)")
        connection.execute("INSERT INTO public.sentinel VALUES ('preserve me')")
        connection.execute("CREATE SCHEMA gateway")
        connection.execute("CREATE TABLE gateway.dirty (value text NOT NULL)")

    result = subprocess.run(
        [sys.executable, "-m", "scripts.database", "push"],
        check=False,
        capture_output=True,
        env={**os.environ, "APP_ENVIRONMENT": "development", "DATABASE_URL": database_url},
        text=True,
    )

    assert result.returncode == 0, result.stderr
    with psycopg.connect(database_url.replace("+psycopg", ""), autocommit=True) as connection:
        assert connection.execute("SELECT value FROM public.sentinel").fetchone() == (
            "preserve me",
        )
        assert connection.execute("SELECT to_regclass('gateway.dirty')").fetchone() == (None,)
        assert connection.execute(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'gateway'"
        ).fetchone() == ("gateway",)


def test_development_push_rejects_non_development_environment(database_url: str) -> None:
    result = subprocess.run(
        [sys.executable, "-m", "scripts.database", "push"],
        check=False,
        capture_output=True,
        env={**os.environ, "APP_ENVIRONMENT": "production", "DATABASE_URL": database_url},
        text=True,
    )

    assert result.returncode != 0
    assert "development" in result.stderr


def test_migrate_creates_gateway_history_without_touching_public(database_url: str) -> None:
    with psycopg.connect(database_url.replace("+psycopg", ""), autocommit=True) as connection:
        connection.execute("CREATE TABLE public.migration_sentinel (value text NOT NULL)")
        connection.execute("INSERT INTO public.migration_sentinel VALUES ('preserve me')")
        connection.execute("DROP SCHEMA IF EXISTS gateway CASCADE")

    environment = {**os.environ, "APP_ENVIRONMENT": "production", "DATABASE_URL": database_url}
    first = subprocess.run(
        [sys.executable, "-m", "scripts.database", "migrate"],
        check=False,
        capture_output=True,
        env=environment,
        text=True,
    )
    second = subprocess.run(
        [sys.executable, "-m", "scripts.database", "migrate"],
        check=False,
        capture_output=True,
        env=environment,
        text=True,
    )

    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    with psycopg.connect(database_url.replace("+psycopg", ""), autocommit=True) as connection:
        assert connection.execute("SELECT value FROM public.migration_sentinel").fetchone() == (
            "preserve me",
        )
        assert connection.execute("SELECT version_num FROM gateway.alembic_version").fetchone() == (
            "20260813_01",
        )
        assert connection.execute("SELECT to_regclass('public.alembic_version')").fetchone() == (
            None,
        )


def test_migrations_match_current_metadata(database_url: str) -> None:
    environment = {**os.environ, "APP_ENVIRONMENT": "production", "DATABASE_URL": database_url}
    result = subprocess.run(
        [sys.executable, "-m", "scripts.database", "migrate"],
        check=False,
        capture_output=True,
        env=environment,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    database = Database(database_url)
    try:
        assert asyncio.run(database.is_at_head())
    finally:
        asyncio.run(database.dispose())
    command.check(config(database_url))


def test_revision_command_creates_no_empty_revision_when_metadata_matches_head() -> None:
    assert revision() is False
