"""Fakes for the Input File seam, shared across the `unit` tier.

`FakeInputFileRepository`/`FakeStorage` satisfy `InputFileRepositoryPort`/`StoragePort`
(see `gateway.services.input_files`) so `InputFileService` can be exercised without
Postgres or SeaweedFS. `FakeInputFileService` stands in one level up, for tests of the
REST/MCP layers that only care whether they delegate correctly.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from gateway.repositories.input_files import InputFileRecord
from gateway.services.input_files import DownloadUrl, InputFileNotFoundError, UploadUrl

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


class FakeInputFileRepository:
    def __init__(self) -> None:
        self._owner_by_id: dict[UUID, str] = {}
        self._deleted_ids: set[UUID] = set()

    @asynccontextmanager
    async def create(
        self,
        owner_user_id: str,
        original_filename: str,  # noqa: ARG002 - part of the port's signature
    ) -> AsyncIterator[InputFileRecord]:
        record = InputFileRecord(id=uuid4())
        self._owner_by_id[record.id] = owner_user_id
        yield record

    async def find_active_owned(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> InputFileRecord | None:
        if self._is_active_owned(owner_user_id, input_file_id):
            return InputFileRecord(id=input_file_id)
        return None

    @asynccontextmanager
    async def mark_deleted(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> AsyncIterator[InputFileRecord | None]:
        if not self._is_active_owned(owner_user_id, input_file_id):
            yield None
            return
        self._deleted_ids.add(input_file_id)
        yield InputFileRecord(id=input_file_id)

    def _is_active_owned(self, owner_user_id: str, input_file_id: UUID) -> bool:
        return (
            self._owner_by_id.get(input_file_id) == owner_user_id
            and input_file_id not in self._deleted_ids
        )


class FakeStorage:
    def __init__(self) -> None:
        self.ensure_bucket_calls = 0
        self.uploaded_keys: list[str] = []
        self.downloaded_keys: list[str] = []
        self.deleted_keys: list[str] = []

    def ensure_bucket(self) -> None:
        self.ensure_bucket_calls += 1

    def mint_upload_url(self, key: str, expires_in: int) -> tuple[str, datetime]:
        self.uploaded_keys.append(key)
        return f"http://fake-storage/upload/{key}", datetime.now(UTC) + timedelta(
            seconds=expires_in
        )

    def mint_download_url(self, key: str, expires_in: int) -> tuple[str, datetime]:
        self.downloaded_keys.append(key)
        return f"http://fake-storage/download/{key}", datetime.now(UTC) + timedelta(
            seconds=expires_in
        )

    def delete(self, key: str) -> None:
        self.deleted_keys.append(key)


class FakeInputFileService:
    """Stands in for the whole `InputFileService` in REST/MCP-layer tests."""

    def __init__(self) -> None:
        self.uploaded_for: tuple[str, str] | None = None
        self.downloaded_for: tuple[str, UUID] | None = None
        self.deleted_for: tuple[str, UUID] | None = None
        self.input_file_id = uuid4()

    async def mint_upload_url(self, owner_user_id: str, original_filename: str) -> UploadUrl:
        self.uploaded_for = (owner_user_id, original_filename)
        return UploadUrl(
            id=self.input_file_id,
            upload_url="http://seaweedfs/upload",
            expires_at=datetime.now(UTC),
        )

    async def mint_download_url(self, owner_user_id: str, input_file_id: UUID) -> DownloadUrl:
        self.downloaded_for = (owner_user_id, input_file_id)
        if owner_user_id != "user-a":
            raise InputFileNotFoundError
        return DownloadUrl(download_url="http://seaweedfs/download", expires_at=datetime.now(UTC))

    async def delete(self, owner_user_id: str, input_file_id: UUID) -> None:
        self.deleted_for = (owner_user_id, input_file_id)
        if owner_user_id != "user-a":
            raise InputFileNotFoundError
