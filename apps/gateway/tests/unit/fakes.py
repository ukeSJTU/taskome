"""Fakes for the Input File seam, shared across the `unit` tier.

`FakeInputFileRepository`/`FakeStorage` satisfy `InputFileRepositoryPort`/`StoragePort`
(see `gateway.services.input_files`) so `InputFileService` can be exercised without
Postgres or SeaweedFS. `FakeInputFileService` stands in one level up, for tests of the
REST/MCP layers that only care whether they delegate correctly.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from gateway.repositories.input_files import InputFileRecord
from gateway.services.input_files import DownloadUrl, InputFileNotFoundError, UploadUrl


class FakeInputFileRepository:
    def __init__(self, events: list[str] | None = None) -> None:
        self._owner_by_id: dict[UUID, str] = {}
        self._deleted_ids: set[UUID] = set()
        self._events = events

    async def create(
        self,
        input_file_id: UUID,
        owner_user_id: str,
        original_filename: str,  # noqa: ARG002 - part of the port's signature
    ) -> InputFileRecord:
        if self._events is not None:
            self._events.append("repository.create")
        record = InputFileRecord(id=input_file_id)
        self._owner_by_id[record.id] = owner_user_id
        return record

    async def find_active_owned(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> InputFileRecord | None:
        if self._is_active_owned(owner_user_id, input_file_id):
            return InputFileRecord(id=input_file_id)
        return None

    async def mark_deleted(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> InputFileRecord | None:
        if not self._is_active_owned(owner_user_id, input_file_id):
            return None
        self._deleted_ids.add(input_file_id)
        if self._events is not None:
            self._events.append("repository.mark_deleted")
        return InputFileRecord(id=input_file_id)

    def _is_active_owned(self, owner_user_id: str, input_file_id: UUID) -> bool:
        return (
            self._owner_by_id.get(input_file_id) == owner_user_id
            and input_file_id not in self._deleted_ids
        )


class FakeStorage:
    def __init__(self, events: list[str] | None = None) -> None:
        self.ensure_bucket_calls = 0
        self.uploaded_keys: list[str] = []
        self.uploaded_sizes: list[int] = []
        self.downloaded_keys: list[str] = []
        self.deleted_keys: list[str] = []
        self._events = events

    def ensure_bucket(self) -> None:
        self.ensure_bucket_calls += 1
        if self._events is not None:
            self._events.append("storage.ensure_bucket")

    def mint_upload_url(
        self,
        key: str,
        expires_in: int,
        size_bytes: int,
    ) -> tuple[str, datetime]:
        self.uploaded_keys.append(key)
        self.uploaded_sizes.append(size_bytes)
        if self._events is not None:
            self._events.append("storage.mint_upload_url")
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
        if self._events is not None:
            self._events.append("storage.delete")


class FakeInputFileService:
    """Stands in for the whole `InputFileService` in REST/MCP-layer tests."""

    def __init__(self) -> None:
        self.uploaded_for: tuple[str, str, int] | None = None
        self.downloaded_for: tuple[str, UUID] | None = None
        self.deleted_for: tuple[str, UUID] | None = None
        self.input_file_id = uuid4()

    async def mint_upload_url(
        self,
        owner_user_id: str,
        original_filename: str,
        size_bytes: int,
    ) -> UploadUrl:
        self.uploaded_for = (owner_user_id, original_filename, size_bytes)
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
