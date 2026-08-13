from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import select

from gateway.db.models import InputFile

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from gateway.db.database import Database


@dataclass(frozen=True, slots=True)
class InputFileRecord:
    id: UUID


class InputFileRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

    @asynccontextmanager
    async def create(
        self,
        owner_user_id: str,
        original_filename: str,
    ) -> AsyncIterator[InputFileRecord]:
        async with self._database.transaction() as session:
            input_file = InputFile(
                id=uuid4(),
                owner_user_id=owner_user_id,
                original_filename=original_filename,
            )
            session.add(input_file)
            await session.flush()
            yield InputFileRecord(id=input_file.id)

    async def find_active_owned(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> InputFileRecord | None:
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

    @asynccontextmanager
    async def mark_deleted(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> AsyncIterator[InputFileRecord | None]:
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
                yield None
                return
            input_file.deleted_at = datetime.now(UTC)
            await session.flush()
            yield InputFileRecord(id=input_file.id)
