from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID  # noqa: TC003

if TYPE_CHECKING:
    from datetime import datetime

    from gateway.repositories.input_files import InputFileRepository
    from gateway.services.storage import SeaweedFSStorage

UPLOAD_URL_TTL_SECONDS = 900


class InputFileNotFoundError(Exception):
    """The requested Input File is absent, deleted, or owned by another user."""


@dataclass(frozen=True, slots=True)
class UploadUrl:
    id: UUID
    upload_url: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class DownloadUrl:
    download_url: str
    expires_at: datetime


class InputFileService:
    def __init__(
        self,
        *,
        repository: InputFileRepository,
        storage: SeaweedFSStorage,
        url_ttl_seconds: int = UPLOAD_URL_TTL_SECONDS,
    ) -> None:
        self._repository = repository
        self._storage = storage
        self._url_ttl_seconds = url_ttl_seconds

    async def mint_upload_url(self, owner_user_id: str, original_filename: str) -> UploadUrl:
        # TODO @taskome: enforce a maximum file size.  # noqa: TD003, FIX002
        # The upload proxy/deployment limits are not settled yet.
        async with self._repository.create(owner_user_id, original_filename) as input_file:
            await asyncio.to_thread(self._storage.ensure_bucket)
            upload_url, expires_at = await asyncio.to_thread(
                self._storage.mint_upload_url,
                self._storage_key(input_file.id),
                self._url_ttl_seconds,
            )
        return UploadUrl(id=input_file.id, upload_url=upload_url, expires_at=expires_at)

    async def mint_download_url(self, owner_user_id: str, input_file_id: UUID) -> DownloadUrl:
        input_file = await self._repository.find_active_owned(owner_user_id, input_file_id)
        if input_file is None:
            raise InputFileNotFoundError
        await asyncio.to_thread(self._storage.ensure_bucket)
        download_url, expires_at = await asyncio.to_thread(
            self._storage.mint_download_url,
            self._storage_key(input_file.id),
            self._url_ttl_seconds,
        )
        return DownloadUrl(download_url=download_url, expires_at=expires_at)

    async def delete(self, owner_user_id: str, input_file_id: UUID) -> None:
        # TODO @taskome: block deletion while active Jobs reference it.  # noqa: TD003, FIX002
        # The Job query does not exist yet.
        async with self._repository.mark_deleted(owner_user_id, input_file_id) as input_file:
            if input_file is None:
                raise InputFileNotFoundError
            await asyncio.to_thread(
                self._storage.delete,
                self._storage_key(input_file.id),
            )

    @staticmethod
    def _storage_key(input_file_id: UUID) -> str:
        return f"uploads/{input_file_id}"
