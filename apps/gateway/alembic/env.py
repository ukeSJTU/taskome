from __future__ import annotations

from alembic import context
from gateway.db.base import GATEWAY_SCHEMA
from gateway.models import metadata
from sqlalchemy import engine_from_config, pool, text

config = context.config
target_metadata = metadata


def include_object(object_, _name, _type, _reflected, _compare_to) -> bool:  # noqa: ANN001
    return getattr(object_, "schema", GATEWAY_SCHEMA) == GATEWAY_SCHEMA


def run_migrations_offline() -> None:
    raise RuntimeError("Offline migration SQL generation is not supported")  # noqa: TRY003, EM101


def do_run_migrations(connection) -> None:  # noqa: ANN001
    connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {GATEWAY_SCHEMA}"))
    context.configure(
        connection=connection,
        compare_server_default=True,
        compare_type=True,
        include_object=include_object,
        include_schemas=True,
        target_metadata=target_metadata,
        version_table_schema=GATEWAY_SCHEMA,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.begin() as connection:
        do_run_migrations(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
