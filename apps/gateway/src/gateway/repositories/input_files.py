"""Postgres persistence for user-owned Input File metadata."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID  # noqa: TC003 - SQLAlchemy expressions use UUID at runtime.

from sqlalchemy import select

from gateway.models import InputFile

if TYPE_CHECKING:
    from gateway.db.database import Database


@dataclass(frozen=True, slots=True)
class InputFileRecord:
    """Minimal committed Input File record returned to the service layer."""

    id: UUID


class InputFileRepository:
    """Persist Input Files in short, self-contained transactions."""

    def __init__(self, database: Database) -> None:
        self._database = database

    async def create(
        self,
        input_file_id: UUID,
        owner_user_id: str,
        original_filename: str,
    ) -> InputFileRecord:
        """Commit a new Input File metadata record."""

        async with self._database.transaction() as session:
            input_file = InputFile(
                id=input_file_id,
                owner_user_id=owner_user_id,
                original_filename=original_filename,
            )
            session.add(input_file)
            await session.flush()
        return InputFileRecord(id=input_file.id)

    async def find_active_owned(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> InputFileRecord | None:
        """Find an active Input File owned by a user."""

        async with self._database.transaction() as session:
            input_file = (
                await session.execute(
                    select(InputFile).where(
                        InputFile.id == input_file_id,
                        InputFile.owner_user_id == owner_user_id,
                        InputFile.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
        return None if input_file is None else InputFileRecord(id=input_file.id)

    async def mark_deleted(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> InputFileRecord | None:
        """Commit a soft delete while holding the row lock only in Postgres."""

        async with self._database.transaction() as session:
            input_file = (
                await session.execute(
                    select(InputFile)
                    .where(
                        InputFile.id == input_file_id,
                        InputFile.owner_user_id == owner_user_id,
                        InputFile.deleted_at.is_(None),
                    )
                    .with_for_update()
                )
            ).scalar_one_or_none()
            if input_file is None:
                return None
            input_file.deleted_at = datetime.now(UTC)
            await session.flush()
        return InputFileRecord(id=input_file.id)
