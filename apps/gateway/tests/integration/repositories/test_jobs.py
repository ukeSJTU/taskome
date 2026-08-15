"""`JobRepository` against real Postgres.

This is the one place SQL/ownership-scoping/state-transition semantics get
verified -- `JobService`'s own tests fake this layer out entirely, on purpose
(see docs/engineering/testing.md's seam table).
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from gateway.models.jobs import JobStatus
from gateway.repositories.jobs import JobRepository

if TYPE_CHECKING:
    from gateway.db.database import Database
    from gateway.repositories.jobs import JobRecord


async def _create(repository: JobRepository, *, owner_user_id: str = "user-a") -> JobRecord:
    return await repository.create(
        job_id=uuid4(),
        owner_user_id=owner_user_id,
        task_server_name="fpocket",
        task_name="detect_pockets",
        params={"structure": str(uuid4())},
        params_schema_version=1,
    )


async def test_create_persists_a_queued_job_with_the_submitted_shape(database: Database) -> None:
    repository = JobRepository(database)

    created = await _create(repository)

    assert created.status is JobStatus.QUEUED
    assert created.task_server_name == "fpocket"
    assert created.task_name == "detect_pockets"
    assert created.result is None
    assert created.error_detail is None


async def test_find_owned_returns_the_record_to_its_owner(database: Database) -> None:
    repository = JobRepository(database)
    created = await _create(repository, owner_user_id="user-a")

    found = await repository.find_owned("user-a", created.id)

    assert found is not None
    assert found.id == created.id
    assert found.params == created.params


async def test_find_owned_hides_the_record_from_other_users(database: Database) -> None:
    repository = JobRepository(database)
    created = await _create(repository, owner_user_id="user-a")

    assert await repository.find_owned("user-b", created.id) is None


async def test_find_owned_returns_none_for_an_unknown_id(database: Database) -> None:
    repository = JobRepository(database)

    assert await repository.find_owned("user-a", uuid4()) is None


async def test_find_by_id_returns_a_job_regardless_of_owner(database: Database) -> None:
    repository = JobRepository(database)
    created = await _create(repository, owner_user_id="user-a")

    found = await repository.find_by_id(created.id)

    assert found is not None
    assert found.owner_user_id == "user-a"


async def test_find_by_id_returns_none_for_an_unknown_id(database: Database) -> None:
    repository = JobRepository(database)

    assert await repository.find_by_id(uuid4()) is None


async def test_mark_running_transitions_the_status(database: Database) -> None:
    repository = JobRepository(database)
    created = await _create(repository)

    running = await repository.mark_running(created.id)

    assert running is not None
    assert running.status is JobStatus.RUNNING


async def test_mark_completed_persists_the_result(database: Database) -> None:
    repository = JobRepository(database)
    created = await _create(repository)
    await repository.mark_running(created.id)

    completed = await repository.mark_completed(created.id, result={"pocket_count": 0})

    assert completed is not None
    assert completed.status is JobStatus.COMPLETED
    assert completed.result == {"pocket_count": 0}

    found = await repository.find_owned("user-a", created.id)
    assert found is not None
    assert found.status is JobStatus.COMPLETED
    assert found.result == {"pocket_count": 0}


async def test_mark_failed_persists_the_error_detail(database: Database) -> None:
    repository = JobRepository(database)
    created = await _create(repository)
    await repository.mark_running(created.id)

    failed = await repository.mark_failed(
        created.id,
        error_detail={"error_type": "compute_failed", "detail": "Task execution failed."},
    )

    assert failed is not None
    assert failed.status is JobStatus.FAILED
    assert failed.error_detail == {
        "error_type": "compute_failed",
        "detail": "Task execution failed.",
    }


async def test_list_owned_is_scoped_to_the_owner(database: Database) -> None:
    repository = JobRepository(database)
    await _create(repository, owner_user_id="user-a")
    await _create(repository, owner_user_id="user-b")

    jobs = await repository.list_owned("user-a", status=None, task_name=None, limit=50, offset=0)

    assert len(jobs) == 1


async def test_list_owned_filters_by_status(database: Database) -> None:
    repository = JobRepository(database)
    queued = await _create(repository)
    running = await _create(repository)
    await repository.mark_running(running.id)

    jobs = await repository.list_owned(
        "user-a", status=JobStatus.QUEUED, task_name=None, limit=50, offset=0
    )

    assert [job.id for job in jobs] == [queued.id]


async def test_list_owned_filters_by_task_name(database: Database) -> None:
    repository = JobRepository(database)
    await _create(repository)
    other_task = await repository.create(
        job_id=uuid4(),
        owner_user_id="user-a",
        task_server_name="fpocket",
        task_name="other_task",
        params={},
        params_schema_version=1,
    )

    jobs = await repository.list_owned(
        "user-a", status=None, task_name="other_task", limit=50, offset=0
    )

    assert [job.id for job in jobs] == [other_task.id]


async def test_list_owned_paginates_newest_first(database: Database) -> None:
    repository = JobRepository(database)
    first = await _create(repository)
    second = await _create(repository)

    page = await repository.list_owned("user-a", status=None, task_name=None, limit=1, offset=0)
    assert [job.id for job in page] == [second.id]

    next_page = await repository.list_owned(
        "user-a", status=None, task_name=None, limit=1, offset=1
    )
    assert [job.id for job in next_page] == [first.id]
