"""Gateway Worker orchestration through its repository, queue, and dispatch ports."""

from __future__ import annotations

from uuid import uuid4

import pytest
from gateway.models.jobs import JobStatus
from gateway.services.job_dispatch import JobDispatchService
from gateway.services.task_dispatch import DispatchFailure, RetryableDispatchError
from gateway.services.task_manifests import TaskManifest
from task_kit import TaskResources

from tests.unit.fakes import FakeDispatcher, FakeJobQueue, FakeJobRepository, FakeResourceBroker

_MANIFESTS = {
    "fpocket": {
        "detect_pockets": TaskManifest(
            task_server_name="fpocket",
            task_name="detect_pockets",
            description="Detect binding pockets.",
            params_schema={"type": "object"},
            result_schema={"type": "object"},
            schema_version=1,
            resources=TaskResources(num_cpus=2, num_gpus=0),
            max_duration_seconds=90,
        )
    }
}


async def test_claim_job_moves_a_queued_job_to_running_and_enqueues_dispatch() -> None:
    repository = FakeJobRepository()
    queue = FakeJobQueue()
    job_id = uuid4()
    await repository.create(
        job_id=job_id,
        owner_user_id="user-a",
        task_server_name="fpocket",
        task_name="detect_pockets",
        params={"structure": str(uuid4())},
        params_schema_version=1,
    )
    worker = JobDispatchService(
        repository=repository,
        queue=queue,
        dispatcher=FakeDispatcher(),
        resources=FakeResourceBroker(),
        manifests={},
    )

    await worker.claim_job(job_id)

    record = await repository.find_by_id(job_id)
    assert record is not None
    assert record.status is JobStatus.RUNNING
    assert queue.dispatch_job_ids == [job_id]


async def test_claim_job_is_a_queued_only_compare_and_set() -> None:
    repository = FakeJobRepository()
    queue = FakeJobQueue()
    job_id = uuid4()
    await repository.create(
        job_id=job_id,
        owner_user_id="user-a",
        task_server_name="fpocket",
        task_name="detect_pockets",
        params={},
        params_schema_version=1,
    )
    worker = JobDispatchService(
        repository=repository,
        queue=queue,
        dispatcher=FakeDispatcher(),
        resources=FakeResourceBroker(),
        manifests=_MANIFESTS,
    )

    await worker.claim_job(job_id)
    await repository.mark_completed(job_id, result={})
    await worker.claim_job(job_id)

    record = await repository.find_by_id(job_id)
    assert record is not None
    assert record.status is JobStatus.COMPLETED
    assert queue.dispatch_job_ids == [job_id]


async def test_execute_dispatch_releases_manifest_resources_after_completion() -> None:
    repository = FakeJobRepository()
    resources = FakeResourceBroker()
    dispatcher = FakeDispatcher()
    job_id = uuid4()
    await repository.create(
        job_id=job_id,
        owner_user_id="user-a",
        task_server_name="fpocket",
        task_name="detect_pockets",
        params={"structure": str(uuid4())},
        params_schema_version=1,
    )
    await repository.mark_running(job_id)
    worker = JobDispatchService(
        repository=repository,
        queue=FakeJobQueue(),
        dispatcher=dispatcher,
        resources=resources,
        manifests=_MANIFESTS,
    )

    await worker.execute_dispatch(job_id)

    record = await repository.find_by_id(job_id)
    assert record is not None
    assert record.status is JobStatus.COMPLETED
    assert resources.reserved == [TaskResources(num_cpus=2, num_gpus=0)]
    assert resources.released == [TaskResources(num_cpus=2, num_gpus=0)]
    assert dispatcher.timeouts == [90]


async def test_execute_dispatch_marks_terminal_failure_and_releases_resources() -> None:
    repository = FakeJobRepository()
    resources = FakeResourceBroker()
    job_id = uuid4()
    await repository.create(
        job_id=job_id,
        owner_user_id="user-a",
        task_server_name="fpocket",
        task_name="detect_pockets",
        params={},
        params_schema_version=1,
    )
    await repository.mark_running(job_id)
    worker = JobDispatchService(
        repository=repository,
        queue=FakeJobQueue(),
        dispatcher=FakeDispatcher(
            DispatchFailure(error_detail={"error_type": "execution_timed_out"})
        ),
        resources=resources,
        manifests=_MANIFESTS,
    )

    await worker.execute_dispatch(job_id)

    record = await repository.find_by_id(job_id)
    assert record is not None
    assert record.status is JobStatus.FAILED
    assert record.error_detail == {"error_type": "execution_timed_out"}
    assert resources.released == [TaskResources(num_cpus=2, num_gpus=0)]


async def test_execute_dispatch_rethrows_only_retryable_pre_delivery_failures() -> None:
    repository = FakeJobRepository()
    resources = FakeResourceBroker()
    job_id = uuid4()
    await repository.create(
        job_id=job_id,
        owner_user_id="user-a",
        task_server_name="fpocket",
        task_name="detect_pockets",
        params={},
        params_schema_version=1,
    )
    await repository.mark_running(job_id)
    worker = JobDispatchService(
        repository=repository,
        queue=FakeJobQueue(),
        dispatcher=FakeDispatcher(error=RetryableDispatchError()),
        resources=resources,
        manifests=_MANIFESTS,
    )

    with pytest.raises(RetryableDispatchError):
        await worker.execute_dispatch(job_id)

    record = await repository.find_by_id(job_id)
    assert record is not None
    assert record.status is JobStatus.RUNNING
    assert resources.released == [TaskResources(num_cpus=2, num_gpus=0)]
