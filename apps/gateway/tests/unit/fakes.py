"""Fakes for the Input File and Job seams, shared across the `unit` tier.

`FakeInputFileRepository`/`FakeStorage` satisfy `InputFileRepositoryPort`/`StoragePort`
(see `gateway.services.input_files`) so `InputFileService` can be exercised without
Postgres or SeaweedFS. `FakeInputFileService` stands in one level up, for tests of the
REST/MCP layers that only care whether they delegate correctly. `FakeJobRepository`/
`FakeDispatcher` do the same for `JobService` (see `gateway.services.jobs`).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from gateway.models.jobs import JobStatus
from gateway.repositories.input_files import InputFileRecord
from gateway.repositories.jobs import JobRecord
from gateway.services.input_files import DownloadUrl, InputFileNotFoundError, UploadUrl
from gateway.services.jobs import JobNotFoundError
from gateway.services.task_dispatch import DispatchFailure, DispatchOutcome, DispatchSuccess

if TYPE_CHECKING:
    from task_kit import TaskResources


class FakeInputFileRepository:
    def __init__(self, events: list[str] | None = None) -> None:
        self._owner_by_id: dict[UUID, str] = {}
        self._size_by_id: dict[UUID, int] = {}
        self._deleted_ids: set[UUID] = set()
        self._events = events

    async def create(
        self,
        input_file_id: UUID,
        owner_user_id: str,
        original_filename: str,  # noqa: ARG002 - part of the port's signature
        size_bytes: int = 1024,
    ) -> InputFileRecord:
        if self._events is not None:
            self._events.append("repository.create")
        record = InputFileRecord(id=input_file_id, size_bytes=size_bytes)
        self._owner_by_id[record.id] = owner_user_id
        self._size_by_id[record.id] = size_bytes
        return record

    async def find_active_owned(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> InputFileRecord | None:
        if self._is_active_owned(owner_user_id, input_file_id):
            return InputFileRecord(id=input_file_id, size_bytes=self._size_by_id[input_file_id])
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
        return InputFileRecord(id=input_file_id, size_bytes=self._size_by_id[input_file_id])

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
        self.task_downloaded_keys: list[str] = []
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

    def mint_task_download_url(self, key: str, expires_in: int) -> tuple[str, datetime]:
        self.task_downloaded_keys.append(key)
        return f"http://fake-task-storage/download/{key}", datetime.now(UTC) + timedelta(
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


class FakeJobRepository:
    def __init__(self, events: list[str] | None = None) -> None:
        self._jobs: dict[UUID, JobRecord] = {}
        self._events = events

    async def create(  # noqa: PLR0913
        self,
        *,
        job_id: UUID,
        owner_user_id: str,
        task_server_name: str,
        task_name: str,
        params: dict[str, Any],
        params_schema_version: int,
    ) -> JobRecord:
        now = datetime.now(UTC)
        record = JobRecord(
            id=job_id,
            owner_user_id=owner_user_id,
            task_server_name=task_server_name,
            task_name=task_name,
            params=params,
            params_schema_version=params_schema_version,
            status=JobStatus.QUEUED,
            result=None,
            error_detail=None,
            created_at=now,
            updated_at=now,
            last_heartbeat_at=None,
        )
        self._jobs[job_id] = record
        if self._events is not None:
            self._events.append("repository.create")
        return record

    async def find_owned(self, owner_user_id: str, job_id: UUID) -> JobRecord | None:
        record = self._jobs.get(job_id)
        if record is None or record.owner_user_id != owner_user_id:
            return None
        return record

    async def find_by_id(self, job_id: UUID) -> JobRecord | None:
        return self._jobs.get(job_id)

    async def list_owned(
        self,
        owner_user_id: str,
        *,
        status: JobStatus | None,
        task_name: str | None,
        limit: int,
        offset: int,
    ) -> tuple[JobRecord, ...]:
        matches = [
            record
            for record in self._jobs.values()
            if record.owner_user_id == owner_user_id
            and (status is None or record.status is status)
            and (task_name is None or record.task_name == task_name)
        ]
        matches.sort(key=lambda record: record.created_at, reverse=True)
        return tuple(matches[offset : offset + limit])

    async def mark_running(self, job_id: UUID) -> JobRecord | None:
        if self._events is not None:
            self._events.append("repository.mark_running")
        record = self._jobs.get(job_id)
        if record is None or record.status is not JobStatus.QUEUED:
            return None
        return self._transition(
            job_id, status=JobStatus.RUNNING, last_heartbeat_at=datetime.now(UTC)
        )

    async def touch_heartbeat(self, job_id: UUID) -> JobRecord | None:
        record = self._jobs.get(job_id)
        if record is None or record.status is not JobStatus.RUNNING:
            return None
        return self._transition(
            job_id, status=JobStatus.RUNNING, last_heartbeat_at=datetime.now(UTC)
        )

    async def mark_completed(self, job_id: UUID, *, result: dict[str, Any]) -> JobRecord | None:
        if self._events is not None:
            self._events.append("repository.mark_completed")
        return self._transition(job_id, status=JobStatus.COMPLETED, result=result)

    async def mark_failed(self, job_id: UUID, *, error_detail: dict[str, Any]) -> JobRecord | None:
        if self._events is not None:
            self._events.append("repository.mark_failed")
        return self._transition(job_id, status=JobStatus.FAILED, error_detail=error_detail)

    async def mark_stale_failed(
        self,
        job_id: UUID,
        *,
        stale_before: datetime,
        error_detail: dict[str, Any],
    ) -> JobRecord | None:
        record = self._jobs.get(job_id)
        if (
            record is None
            or record.status is not JobStatus.RUNNING
            or (record.last_heartbeat_at is not None and record.last_heartbeat_at > stale_before)
        ):
            return None
        return self._transition(job_id, status=JobStatus.FAILED, error_detail=error_detail)

    def _transition(
        self,
        job_id: UUID,
        *,
        status: JobStatus,
        result: dict[str, Any] | None = None,
        error_detail: dict[str, Any] | None = None,
        last_heartbeat_at: datetime | None = None,
    ) -> JobRecord | None:
        record = self._jobs.get(job_id)
        if record is None:
            return None
        changes: dict[str, Any] = {"status": status, "updated_at": datetime.now(UTC)}
        if result is not None:
            changes["result"] = result
        if error_detail is not None:
            changes["error_detail"] = error_detail
        if last_heartbeat_at is not None:
            changes["last_heartbeat_at"] = last_heartbeat_at
        updated = replace(record, **changes)
        self._jobs[job_id] = updated
        return updated

    def force_updated_at(self, job_id: UUID, updated_at: datetime) -> None:
        """Test-only hook to age a Job's general update timestamp."""

        self._jobs[job_id] = replace(self._jobs[job_id], updated_at=updated_at)

    def force_heartbeat_at(self, job_id: UUID, heartbeat_at: datetime) -> None:
        self._jobs[job_id] = replace(self._jobs[job_id], last_heartbeat_at=heartbeat_at)


class FakeDispatcher:
    """Controllable stand-in for `TaskDispatcher` -- no HTTP, no HMAC."""

    def __init__(
        self, outcome: DispatchOutcome | None = None, error: Exception | None = None
    ) -> None:
        self.outcome = outcome or DispatchSuccess(result={"value": {}, "outputs": []})
        self.error = error
        self.calls: list[tuple[str, str, UUID, dict[str, Any]]] = []
        self.timeouts: list[int] = []

    async def dispatch(
        self,
        *,
        task_server_name: str,
        task_name: str,
        job_id: UUID,
        params: dict[str, Any],
        timeout_seconds: int = 30,
    ) -> DispatchOutcome:
        self.calls.append((task_server_name, task_name, job_id, params))
        self.timeouts.append(timeout_seconds)
        if self.error is not None:
            raise self.error
        return self.outcome


class FakeResourceBroker:
    """In-memory resource reservation boundary for worker orchestration tests."""

    def __init__(self) -> None:
        self.reserved: list[TaskResources] = []
        self.released: list[TaskResources] = []

    @asynccontextmanager
    async def reserve(self, resources: TaskResources):
        self.reserved.append(resources)
        try:
            yield
        finally:
            self.released.append(resources)


class FakeJobQueue:
    """In-memory queue boundary for service-layer submission tests."""

    def __init__(self) -> None:
        self.job_ids: list[UUID] = []
        self.dispatch_job_ids: list[UUID] = []
        self.started = False
        self.closed = False

    async def start(self) -> None:
        self.started = True

    async def aclose(self) -> None:
        self.closed = True

    async def enqueue_claim(self, job_id: UUID) -> None:
        self.job_ids.append(job_id)

    async def enqueue_dispatch(self, job_id: UUID) -> None:
        self.dispatch_job_ids.append(job_id)


class FakeJobService:
    """Stands in for the whole `JobService` in REST/MCP-layer tests."""

    def __init__(self) -> None:
        self.job_id = uuid4()
        self.submitted_for: tuple[str, str, str, dict[str, Any]] | None = None
        self.fetched_for: tuple[str, UUID] | None = None
        self.listed_for: tuple[str, JobStatus | None, str | None, int, int] | None = None
        self.raise_on_submit: Exception | None = None
        self.waited_for: tuple[str, UUID, int] | None = None
        self.raise_on_wait: Exception | None = None
        self.wait_result: JobRecord | None = None
        self.get_result: dict[str, Any] | None = None

    def make_record(self, **overrides: Any) -> JobRecord:  # noqa: ANN401
        now = datetime.now(UTC)
        fields: dict[str, Any] = {
            "id": self.job_id,
            "owner_user_id": "user-a",
            "task_server_name": "fpocket",
            "task_name": "detect_pockets",
            "params": {"structure": str(uuid4())},
            "params_schema_version": 1,
            "status": JobStatus.QUEUED,
            "result": None,
            "error_detail": None,
            "created_at": now,
            "updated_at": now,
            "last_heartbeat_at": None,
        }
        fields.update(overrides)
        return JobRecord(**fields)

    async def submit_job(
        self,
        owner_user_id: str,
        task_server_name: str,
        task_name: str,
        params: dict[str, Any],
    ) -> JobRecord:
        self.submitted_for = (owner_user_id, task_server_name, task_name, params)
        if self.raise_on_submit is not None:
            raise self.raise_on_submit
        return self.make_record(
            owner_user_id=owner_user_id,
            task_server_name=task_server_name,
            task_name=task_name,
            params=params,
        )

    async def wait_job(self, owner_user_id: str, job_id: UUID, timeout_seconds: int) -> JobRecord:
        self.waited_for = (owner_user_id, job_id, timeout_seconds)
        if self.raise_on_wait is not None:
            raise self.raise_on_wait
        if self.wait_result is not None:
            return self.wait_result
        return self.make_record(owner_user_id=owner_user_id, id=job_id, result=self.get_result)

    async def get_job(self, owner_user_id: str, job_id: UUID) -> JobRecord:
        self.fetched_for = (owner_user_id, job_id)
        if owner_user_id != "user-a":
            raise JobNotFoundError
        return self.make_record(owner_user_id=owner_user_id, id=job_id, result=self.get_result)

    async def list_jobs(
        self,
        owner_user_id: str,
        *,
        status: JobStatus | None,
        task_name: str | None,
        limit: int,
        offset: int,
    ) -> tuple[JobRecord, ...]:
        self.listed_for = (owner_user_id, status, task_name, limit, offset)
        return (self.make_record(owner_user_id=owner_user_id),)


__all__ = [
    "DispatchFailure",
    "DispatchSuccess",
    "FakeDispatcher",
    "FakeInputFileRepository",
    "FakeInputFileService",
    "FakeJobQueue",
    "FakeJobRepository",
    "FakeJobService",
    "FakeResourceBroker",
    "FakeStorage",
]
