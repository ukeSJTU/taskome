"""Job Output download authorization and short-lived URL minting."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

from gateway.models.jobs import JobStatus
from gateway.services.input_files import PRESIGNED_URL_TTL_SECONDS, DownloadUrl, StoragePort

if TYPE_CHECKING:
    from uuid import UUID

    from gateway.repositories.jobs import JobRecord


class JobOutputNotFoundError(Exception):
    """The Job Output is absent, unavailable, or not owned by the caller."""


class JobOutputRepositoryPort(Protocol):
    """What `JobOutputService` needs from the Job store."""

    async def find_owned(self, owner_user_id: str, job_id: UUID) -> JobRecord | None: ...


@dataclass(frozen=True, slots=True)
class _PublishedOutput:
    name: str
    storage_key: str


class JobOutputService:
    """Authorize Job Output downloads without exposing storage keys."""

    def __init__(
        self,
        *,
        repository: JobOutputRepositoryPort,
        storage: StoragePort | None = None,
        url_ttl_seconds: int = PRESIGNED_URL_TTL_SECONDS,
    ) -> None:
        self._repository = repository
        self._storage = storage
        self._url_ttl_seconds = url_ttl_seconds

    def attach_storage(self, storage: StoragePort) -> None:
        if self._storage is not None and self._storage is not storage:
            raise RuntimeError("Job Output storage is already attached")  # noqa: TRY003, EM101
        self._storage = storage

    async def mint_download_url(
        self, owner_user_id: str, job_id: UUID, output_name: str
    ) -> DownloadUrl:
        """Mint download access for a declared output of a caller-owned completed Job."""

        record = await self._repository.find_owned(owner_user_id, job_id)
        if record is None or record.status is not JobStatus.COMPLETED:
            raise JobOutputNotFoundError
        output = self._find_output(record, output_name)
        if output is None:
            raise JobOutputNotFoundError
        storage = self._require_storage()
        await asyncio.to_thread(storage.ensure_bucket)
        download_url, expires_at = await asyncio.to_thread(
            storage.mint_download_url, output.storage_key, self._url_ttl_seconds
        )
        return DownloadUrl(download_url=download_url, expires_at=expires_at)

    @staticmethod
    def _find_output(record: JobRecord, output_name: str) -> _PublishedOutput | None:
        result = record.result
        if not isinstance(result, dict) or not isinstance(result.get("outputs"), list):
            return None
        expected_key = f"{record.task_server_name}/{record.id}/{output_name}"
        for candidate in result["outputs"]:
            if (
                isinstance(candidate, dict)
                and candidate.get("name") == output_name
                and candidate.get("storage_key") == expected_key
            ):
                return _PublishedOutput(name=output_name, storage_key=expected_key)
        return None

    def _require_storage(self) -> StoragePort:
        if self._storage is None:
            raise RuntimeError("Job Output storage is not attached")  # noqa: TRY003, EM101
        return self._storage
