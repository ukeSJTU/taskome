from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory


def config(database_url: str) -> Config:
    alembic_config = Config()
    alembic_config.set_main_option("script_location", str(Path(__file__).parent / "alembic"))
    alembic_config.set_main_option("sqlalchemy.url", database_url)
    return alembic_config


def upgrade(database_url: str) -> None:
    command.upgrade(config(database_url), "head")


def current_heads() -> tuple[str, ...]:
    return tuple(ScriptDirectory.from_config(config("")).get_heads())
