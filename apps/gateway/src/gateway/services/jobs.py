"""Job submission, validation, dispatch scheduling, and status derivation."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, Protocol
from uuid import UUID, uuid4

import jsonschema
from task_kit import INPUT_FILE_ID_JSON_SCHEMA_MARKER

from gateway.models.jobs import JobStatus

if TYPE_CHECKING:
    from collections.abc import Callable

    from gateway.repositories.input_files import InputFileRecord
    from gateway.repositories.jobs import JobRecord
    from gateway.services.task_manifests import TaskManifest, TaskManifestRegistry

HEARTBEAT_STALE_SECONDS = 60
_WORKER_HEARTBEAT_STALE_DETAIL = {
    "error_type": "worker_heartbeat_stale",
    "detail": "The Gateway Worker stopped reporting progress for this Job.",
}


class TaskNotFoundError(Exception):
    """The requested Task is not registered on any known Task Server."""


class InvalidJobParamsError(Exception):
    """The submitted Params do not match the Task's published contract."""


class JobInputFileNotFoundError(Exception):
    """A Params field referencing an Input File is absent, deleted, or not owned."""

    def __init__(self, field: str, input_file_id: UUID) -> None:
        super().__init__(f"Input File {input_file_id} referenced by '{field}' is not available.")
        self.field = field
        self.input_file_id = input_file_id


class JobNotFoundError(Exception):
    """The requested Job is absent or owned by another user."""


class JobRepositoryPort(Protocol):
    """What `JobService` needs from a repository.

    A port so the service can be tested against a fake instead of a real database.
    """

    async def create(  # noqa: PLR0913
        self,
        *,
        job_id: UUID,
        owner_user_id: str,
        task_server_name: str,
        task_name: str,
        params: dict[str, Any],
        params_schema_version: int,
    ) -> JobRecord: ...

    async def find_owned(self, owner_user_id: str, job_id: UUID) -> JobRecord | None: ...
    async def find_by_id(self, job_id: UUID) -> JobRecord | None: ...

    async def list_owned(
        self,
        owner_user_id: str,
        *,
        status: JobStatus | None,
        task_name: str | None,
        limit: int,
        offset: int,
    ) -> tuple[JobRecord, ...]: ...

    async def mark_running(self, job_id: UUID) -> JobRecord | None: ...
    async def mark_completed(self, job_id: UUID, *, result: dict[str, Any]) -> JobRecord | None: ...
    async def mark_failed(
        self, job_id: UUID, *, error_detail: dict[str, Any]
    ) -> JobRecord | None: ...

    async def touch_heartbeat(self, job_id: UUID) -> JobRecord | None: ...
    async def mark_stale_failed(
        self, job_id: UUID, *, stale_before: datetime, error_detail: dict[str, Any]
    ) -> JobRecord | None: ...


class InputFileLookupPort(Protocol):
    """What `JobService` needs to validate an Input File reference in Params."""

    async def find_active_owned(
        self, owner_user_id: str, input_file_id: UUID
    ) -> InputFileRecord | None: ...


class JobQueuePort(Protocol):
    """Durable intake for Job IDs awaiting a Gateway Worker claim."""

    async def enqueue_claim(self, job_id: UUID) -> None: ...


class JobService:
    """Validate, persist, queue, and read Jobs."""

    def __init__(
        self,
        *,
        repository: JobRepositoryPort,
        input_files: InputFileLookupPort,
        queue: JobQueuePort,
        manifests: TaskManifestRegistry,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repository = repository
        self._input_files = input_files
        self._queue = queue
        self._manifests = manifests
        self._clock = clock

    def attach_manifests(self, manifests: TaskManifestRegistry) -> None:
        """Replace the cached Task manifest registry, fetched once during lifespan startup."""

        self._manifests = manifests

    async def submit_job(
        self,
        owner_user_id: str,
        task_server_name: str,
        task_name: str,
        params: dict[str, Any],
    ) -> JobRecord:
        """Validate, persist, and enqueue a Job without waiting for execution."""

        record = await self._validate_and_create(owner_user_id, task_server_name, task_name, params)
        await self._queue.enqueue_claim(record.id)
        return record

    async def get_job_for_dispatch(self, job_id: UUID) -> JobRecord:
        """Look up a Job by id alone, for the Task-Server-to-Gateway callback boundary.

        Not owner-scoped and never reconciled -- only reachable internally, over the
        HMAC-signed boundary (ADR-0007), while the Job is actively being dispatched.
        """

        record = await self._repository.find_by_id(job_id)
        if record is None:
            raise JobNotFoundError
        return record

    async def get_job(self, owner_user_id: str, job_id: UUID) -> JobRecord:
        """Return a caller-owned Job, reconciling an orphaned `running` status."""

        record = await self._repository.find_owned(owner_user_id, job_id)
        if record is None:
            raise JobNotFoundError
        return await self._reconcile(record)

    async def wait_job(self, owner_user_id: str, job_id: UUID, timeout_seconds: int) -> JobRecord:
        """Poll an owned Job until terminal or the caller's bounded wait expires."""

        deadline = self._clock().timestamp() + timeout_seconds
        while True:
            record = await self.get_job(owner_user_id, job_id)
            if record.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                return record
            remaining = deadline - self._clock().timestamp()
            if remaining <= 0:
                return record
            await asyncio.sleep(min(1, remaining))

    async def list_jobs(
        self,
        owner_user_id: str,
        *,
        status: JobStatus | None,
        task_name: str | None,
        limit: int,
        offset: int,
    ) -> tuple[JobRecord, ...]:
        """List a caller's own Jobs, newest first, reconciling stale heartbeats."""

        records = await self._repository.list_owned(
            owner_user_id, status=status, task_name=task_name, limit=limit, offset=offset
        )
        return tuple([await self._reconcile(record) for record in records])

    async def _validate_and_create(
        self,
        owner_user_id: str,
        task_server_name: str,
        task_name: str,
        params: dict[str, Any],
    ) -> JobRecord:
        manifest = self._manifest_for(task_server_name, task_name)
        _validate_params(manifest, params)
        await self._validate_input_file_references(owner_user_id, manifest, params)
        return await self._repository.create(
            job_id=uuid4(),
            owner_user_id=owner_user_id,
            task_server_name=task_server_name,
            task_name=task_name,
            params=params,
            params_schema_version=manifest.schema_version,
        )

    def _manifest_for(self, task_server_name: str, task_name: str) -> TaskManifest:
        manifest = self._manifests.get(task_server_name, {}).get(task_name)
        if manifest is None:
            raise TaskNotFoundError
        return manifest

    async def _validate_input_file_references(
        self,
        owner_user_id: str,
        manifest: TaskManifest,
        params: dict[str, Any],
    ) -> None:
        for field in _input_file_fields(manifest.params_schema):
            raw_value = params.get(field)
            if not isinstance(raw_value, str):
                continue
            input_file_id = UUID(raw_value)
            found = await self._input_files.find_active_owned(owner_user_id, input_file_id)
            if found is None:
                raise JobInputFileNotFoundError(field, input_file_id)

    async def _reconcile(self, record: JobRecord) -> JobRecord:
        if record.status is not JobStatus.RUNNING:
            return record
        if (
            record.last_heartbeat_at is not None
            and (self._clock() - record.last_heartbeat_at).total_seconds()
            <= HEARTBEAT_STALE_SECONDS
        ):
            return record
        updated = await self._repository.mark_stale_failed(
            record.id,
            stale_before=self._clock() - timedelta(seconds=HEARTBEAT_STALE_SECONDS),
            error_detail=dict(_WORKER_HEARTBEAT_STALE_DETAIL),
        )
        return updated or record


def _validate_params(manifest: TaskManifest, params: dict[str, Any]) -> None:
    try:
        jsonschema.validate(
            instance=params,
            schema=manifest.params_schema,
            format_checker=jsonschema.FormatChecker(),
        )
    except jsonschema.ValidationError as error:
        raise InvalidJobParamsError(error.message) from error


def _input_file_fields(params_schema: dict[str, Any]) -> list[str]:
    defs = params_schema.get("$defs", {})
    properties = params_schema.get("properties", {})
    return [
        name
        for name, field_schema in properties.items()
        if _resolve(field_schema, defs).get(INPUT_FILE_ID_JSON_SCHEMA_MARKER) is True
    ]


def _resolve(schema: dict[str, Any], defs: dict[str, Any]) -> dict[str, Any]:
    ref = schema.get("$ref")
    if isinstance(ref, str):
        return defs.get(ref.rsplit("/", 1)[-1], {})
    return schema
