"""Orchestration logic in `JobService`, isolated from Postgres and the Task Server HTTP boundary.

`JobRepositoryPort`/`InputFileLookupPort`/`JobQueuePort` (see gateway.services.jobs) make
this reachable without Postgres or a real Task Server; the dispatch/resolve wire protocol
gets its own high-fidelity test in tests/integration/services/test_job_dispatch.py.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, cast
from uuid import uuid4

import pytest
from gateway.models.jobs import JobStatus
from task_kit import TaskResources

if TYPE_CHECKING:
    from collections.abc import Callable
    from uuid import UUID

    from gateway.repositories.input_files import InputFileRecord
from gateway.services.jobs import (
    HEARTBEAT_STALE_SECONDS,
    InvalidJobParamsError,
    JobInputFileNotFoundError,
    JobNotFoundError,
    JobService,
    TaskNotFoundError,
)
from gateway.services.task_manifests import TaskManifest

from tests.unit.fakes import (
    FakeDispatcher,
    FakeJobQueue,
    FakeJobRepository,
)

_DETECT_POCKETS_PARAMS_SCHEMA = {
    "type": "object",
    "properties": {
        "structure": {
            "type": "string",
            "format": "uuid",
            "x-taskome-input-file-id": True,
        },
        "min_alpha_size": {"type": "number"},
    },
    "required": ["structure"],
    "additionalProperties": False,
}
_MANIFESTS = {
    "fpocket": {
        "detect_pockets": TaskManifest(
            task_server_name="fpocket",
            task_name="detect_pockets",
            description="Detect binding pockets.",
            params_schema=_DETECT_POCKETS_PARAMS_SCHEMA,
            result_schema={"type": "object"},
            schema_version=1,
            resources=TaskResources(num_cpus=1, num_gpus=0),
            max_duration_seconds=600,
        )
    }
}


class _FakeInputFiles:
    def __init__(self, *, owned_ids: set[str] | None = None) -> None:
        self.owned_ids = owned_ids or set()
        self.checked: list[tuple[str, str]] = []

    async def find_active_owned(
        self, owner_user_id: str, input_file_id: UUID
    ) -> InputFileRecord | None:
        self.checked.append((owner_user_id, str(input_file_id)))
        if str(input_file_id) in self.owned_ids:
            return cast("InputFileRecord", object())
        return None


def _service(
    *,
    dispatcher: FakeDispatcher | None = None,
    input_files: _FakeInputFiles | None = None,
    queue: FakeJobQueue | None = None,
    repository: FakeJobRepository | None = None,
    clock: Callable[[], datetime] | None = None,
) -> tuple[JobService, FakeJobRepository, FakeDispatcher, FakeJobQueue, _FakeInputFiles]:
    repo = repository or FakeJobRepository()
    dispatch = dispatcher or FakeDispatcher()
    job_queue = queue or FakeJobQueue()
    files = input_files or _FakeInputFiles()
    service = JobService(
        repository=repo,
        input_files=files,
        queue=job_queue,
        manifests=_MANIFESTS,
        clock=clock or (lambda: datetime.now(UTC)),
    )
    return service, repo, dispatch, job_queue, files


async def test_submit_job_rejects_an_unknown_task() -> None:
    service, _repo, _dispatch, _queue, _files = _service()

    with pytest.raises(TaskNotFoundError):
        await service.submit_job("user-a", "fpocket", "no_such_task", {})


async def test_submit_job_rejects_params_that_fail_the_manifest_schema() -> None:
    service, _repo, _dispatch, _queue, _files = _service()

    with pytest.raises(InvalidJobParamsError):
        await service.submit_job("user-a", "fpocket", "detect_pockets", {"min_alpha_size": "nan"})


async def test_submit_job_rejects_an_input_file_the_caller_does_not_own() -> None:
    file_id = str(uuid4())
    service, _repo, _dispatch, _queue, files = _service(
        input_files=_FakeInputFiles(owned_ids=set())
    )

    with pytest.raises(JobInputFileNotFoundError):
        await service.submit_job("user-a", "fpocket", "detect_pockets", {"structure": file_id})

    assert files.checked == [("user-a", file_id)]


async def test_submit_job_returns_queued_and_enqueues_claim_without_dispatching() -> None:
    file_id = str(uuid4())
    service, repo, dispatch, queue, _files = _service(
        input_files=_FakeInputFiles(owned_ids={file_id})
    )

    record = await service.submit_job("user-a", "fpocket", "detect_pockets", {"structure": file_id})

    assert record.status is JobStatus.QUEUED
    assert dispatch.calls == []
    assert queue.job_ids == [record.id]
    stored = await repo.find_owned("user-a", record.id)
    assert stored is not None
    assert stored.status is JobStatus.QUEUED


async def test_get_job_rejects_a_job_the_caller_does_not_own() -> None:
    file_id = str(uuid4())
    service, _repo, _dispatch, _queue, _files = _service(
        input_files=_FakeInputFiles(owned_ids={file_id})
    )
    record = await service.submit_job("user-a", "fpocket", "detect_pockets", {"structure": file_id})

    with pytest.raises(JobNotFoundError):
        await service.get_job("user-b", record.id)


async def test_get_job_for_dispatch_ignores_ownership() -> None:
    file_id = str(uuid4())
    service, _repo, _dispatch, _queue, _files = _service(
        input_files=_FakeInputFiles(owned_ids={file_id})
    )
    record = await service.submit_job("user-a", "fpocket", "detect_pockets", {"structure": file_id})

    found = await service.get_job_for_dispatch(record.id)

    assert found.id == record.id
    assert found.owner_user_id == "user-a"


async def test_get_job_for_dispatch_rejects_an_unknown_id() -> None:
    service, _repo, _dispatch, _queue, _files = _service()

    with pytest.raises(JobNotFoundError):
        await service.get_job_for_dispatch(uuid4())


async def test_get_job_reconciles_a_running_job_with_a_stale_worker_heartbeat() -> None:
    file_id = str(uuid4())
    fixed_now = datetime(2026, 1, 1, tzinfo=UTC)
    service, repo, _dispatch, _queue, _files = _service(
        input_files=_FakeInputFiles(owned_ids={file_id}), clock=lambda: fixed_now
    )
    record = await service.submit_job("user-a", "fpocket", "detect_pockets", {"structure": file_id})
    await repo.mark_running(record.id)
    repo.force_heartbeat_at(record.id, fixed_now - timedelta(seconds=HEARTBEAT_STALE_SECONDS + 1))

    reconciled = await service.get_job("user-a", record.id)

    assert reconciled.status is JobStatus.FAILED
    assert reconciled.error_detail is not None
    assert reconciled.error_detail["error_type"] == "worker_heartbeat_stale"


async def test_get_job_leaves_a_running_job_with_a_fresh_heartbeat_alone() -> None:
    file_id = str(uuid4())
    fixed_now = datetime(2026, 1, 1, tzinfo=UTC)
    service, repo, _dispatch, _queue, _files = _service(
        input_files=_FakeInputFiles(owned_ids={file_id}), clock=lambda: fixed_now
    )
    record = await service.submit_job("user-a", "fpocket", "detect_pockets", {"structure": file_id})
    await repo.mark_running(record.id)
    repo.force_heartbeat_at(record.id, fixed_now - timedelta(seconds=HEARTBEAT_STALE_SECONDS - 1))

    reconciled = await service.get_job("user-a", record.id)

    assert reconciled.status is JobStatus.RUNNING


async def test_list_jobs_is_scoped_to_the_owner_and_reconciles_each_page() -> None:
    file_id = str(uuid4())
    fixed_now = datetime(2026, 1, 1, tzinfo=UTC)
    service, repo, _dispatch, _queue, _files = _service(
        input_files=_FakeInputFiles(owned_ids={file_id}), clock=lambda: fixed_now
    )
    record = await service.submit_job("user-a", "fpocket", "detect_pockets", {"structure": file_id})
    await repo.mark_running(record.id)
    repo.force_heartbeat_at(record.id, fixed_now - timedelta(seconds=HEARTBEAT_STALE_SECONDS + 1))
    await service.submit_job("user-b", "fpocket", "detect_pockets", {"structure": file_id})

    jobs = await service.list_jobs("user-a", status=None, task_name=None, limit=50, offset=0)

    assert [job.id for job in jobs] == [record.id]
    assert jobs[0].status is JobStatus.FAILED
