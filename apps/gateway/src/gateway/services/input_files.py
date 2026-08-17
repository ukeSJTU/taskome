"""Input File orchestration with short database transaction boundaries."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol
from uuid import UUID, uuid4

if TYPE_CHECKING:
    from collections.abc import Sequence
    from datetime import datetime

    from gateway.repositories.input_files import InputFileRecord

PRESIGNED_URL_TTL_SECONDS = 900


class InputFileNotFoundError(Exception):
    """The requested Input File is absent, deleted, or owned by another user."""


@dataclass(frozen=True, slots=True)
class UploadUrl:
    """Minted upload location for a newly allocated Input File id."""

    id: UUID
    upload_url: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class DownloadUrl:
    """Minted download location for an existing Input File."""

    download_url: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class ResolvedInputFile:
    """One Input File resolved for a Task Server to materialize."""

    id: UUID
    download_url: str
    size_bytes: int


class InputFileRepositoryPort(Protocol):
    """What `InputFileService` needs from a repository.

    A port so the service can be tested against a fake instead of a real database.
    """

    async def create(
        self,
        input_file_id: UUID,
        owner_user_id: str,
        original_filename: str,
        size_bytes: int,
    ) -> InputFileRecord: ...

    async def find_active_owned(
        self, owner_user_id: str, input_file_id: UUID
    ) -> InputFileRecord | None: ...

    async def mark_deleted(
        self, owner_user_id: str, input_file_id: UUID
    ) -> InputFileRecord | None: ...


class StoragePort(Protocol):
    """What `InputFileService` needs from object storage.

    A port so the service can be tested against a fake instead of a real bucket.
    """

    def ensure_bucket(self) -> None: ...
    def mint_upload_url(
        self,
        key: str,
        expires_in: int,
        size_bytes: int,
    ) -> tuple[str, datetime]: ...
    def mint_download_url(self, key: str, expires_in: int) -> tuple[str, datetime]: ...
    def mint_task_download_url(self, key: str, expires_in: int) -> tuple[str, datetime]: ...
    def delete(self, key: str) -> None: ...


class InputFileService:
    """Coordinate storage operations around committed metadata changes."""

    def __init__(
        self,
        *,
        repository: InputFileRepositoryPort,
        storage: StoragePort | None = None,
        url_ttl_seconds: int = PRESIGNED_URL_TTL_SECONDS,
    ) -> None:
        self._repository = repository
        self._storage = storage
        self._url_ttl_seconds = url_ttl_seconds

    def attach_storage(self, storage: StoragePort) -> None:
        """Attach the process-owned storage client during lifespan startup.

        Args:
            storage: Initialized object-storage boundary owned by the app lifespan.

        Raises:
            RuntimeError: If a different storage client is already attached.
        """

        if self._storage is not None and self._storage is not storage:
            raise RuntimeError("Input File storage is already attached")  # noqa: TRY003, EM101
        self._storage = storage

    async def mint_upload_url(
        self,
        owner_user_id: str,
        original_filename: str,
        size_bytes: int,
    ) -> UploadUrl:
        """Mint storage credentials before recording the Input File in Postgres.

        Args:
            owner_user_id: Authenticated owner of the new Input File.
            original_filename: Display-only filename supplied by the caller.
            size_bytes: Exact object length bound into the presigned URL.

        Returns:
            The allocated id and short-lived upload credentials.

        Raises:
            RuntimeError: If called outside the application lifespan.
        """

        storage = self._require_storage()
        input_file_id = uuid4()
        await asyncio.to_thread(storage.ensure_bucket)
        upload_url, expires_at = await asyncio.to_thread(
            storage.mint_upload_url,
            self._storage_key(input_file_id),
            self._url_ttl_seconds,
            size_bytes,
        )
        input_file = await self._repository.create(
            input_file_id,
            owner_user_id,
            original_filename,
            size_bytes,
        )
        return UploadUrl(id=input_file.id, upload_url=upload_url, expires_at=expires_at)

    async def mint_download_url(self, owner_user_id: str, input_file_id: UUID) -> DownloadUrl:
        """Mint a download URL for an active Input File owned by the caller.

        Args:
            owner_user_id: Authenticated owner expected for the Input File.
            input_file_id: Opaque Input File identifier.

        Returns:
            Short-lived download credentials.

        Raises:
            InputFileNotFoundError: If the file is absent, deleted, or not owned.
            RuntimeError: If called outside the application lifespan.
        """

        storage = self._require_storage()
        input_file = await self._repository.find_active_owned(owner_user_id, input_file_id)
        if input_file is None:
            raise InputFileNotFoundError
        await asyncio.to_thread(storage.ensure_bucket)
        download_url, expires_at = await asyncio.to_thread(
            storage.mint_download_url,
            self._storage_key(input_file.id),
            self._url_ttl_seconds,
        )
        return DownloadUrl(download_url=download_url, expires_at=expires_at)

    async def resolve_for_dispatch(
        self, owner_user_id: str, input_file_ids: Sequence[UUID]
    ) -> tuple[ResolvedInputFile, ...]:
        """Resolve the Input Files a Job's Task Server needs to materialize.

        Called from the internal, HMAC-signed boundary a Task Server uses to fetch
        the files a Job's Params reference (ADR-0007) -- `owner_user_id` here is the
        Job's own recorded owner, not an authenticated REST/MCP caller.

        Raises:
            InputFileNotFoundError: If any requested file is absent, deleted, or
                not owned by the Job's owner.
            RuntimeError: If called outside the application lifespan.
        """

        storage = self._require_storage()
        resolved: list[ResolvedInputFile] = []
        for input_file_id in input_file_ids:
            input_file = await self._repository.find_active_owned(owner_user_id, input_file_id)
            if input_file is None:
                raise InputFileNotFoundError
            await asyncio.to_thread(storage.ensure_bucket)
            download_url, _expires_at = await asyncio.to_thread(
                storage.mint_task_download_url,
                self._storage_key(input_file.id),
                self._url_ttl_seconds,
            )
            resolved.append(
                ResolvedInputFile(
                    id=input_file.id,
                    download_url=download_url,
                    size_bytes=input_file.size_bytes,
                )
            )
        return tuple(resolved)

    async def delete(self, owner_user_id: str, input_file_id: UUID) -> None:
        """Commit the deletion marker before issuing the storage delete.

        Args:
            owner_user_id: Authenticated owner expected for the Input File.
            input_file_id: Opaque Input File identifier.

        Raises:
            InputFileNotFoundError: If the file is absent, deleted, or not owned.
            RuntimeError: If called outside the application lifespan.
        """

        storage = self._require_storage()
        # TODO @taskome: block deletion while active Jobs reference it.  # noqa: TD003, FIX002
        # The Job query does not exist yet.
        input_file = await self._repository.mark_deleted(owner_user_id, input_file_id)
        if input_file is None:
            raise InputFileNotFoundError
        await asyncio.to_thread(
            storage.delete,
            self._storage_key(input_file.id),
        )

    @staticmethod
    def _storage_key(input_file_id: UUID) -> str:
        return f"uploads/{input_file_id}"

    def _require_storage(self) -> StoragePort:
        if self._storage is None:
            raise RuntimeError("Input File service used outside the application lifespan")  # noqa: TRY003, EM101
        return self._storage
