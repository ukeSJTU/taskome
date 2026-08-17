from __future__ import annotations

from uuid import uuid4

import pytest
from gateway.services.job_outputs import JobOutputNotFoundError, JobOutputService

from tests.unit.fakes import FakeJobRepository, FakeStorage


async def test_mint_download_url_only_uses_a_completed_jobs_declared_output() -> None:
    repository = FakeJobRepository()
    storage = FakeStorage()
    job_id = uuid4()
    await repository.create(
        job_id=job_id,
        owner_user_id="user-a",
        task_server_name="fpocket",
        task_name="detect_pockets",
        params={},
        params_schema_version=1,
    )
    await repository.mark_completed(
        job_id,
        result={
            "outputs": [
                {
                    "name": "annotated_structure",
                    "storage_key": f"fpocket/{job_id}/annotated_structure",
                }
            ],
            "value": {},
        },
    )
    service = JobOutputService(repository=repository, storage=storage)

    result = await service.mint_download_url("user-a", job_id, "annotated_structure")

    assert (
        result.download_url == f"http://fake-storage/download/fpocket/{job_id}/annotated_structure"
    )
    assert storage.downloaded_keys == [f"fpocket/{job_id}/annotated_structure"]


async def test_mint_download_url_hides_missing_or_non_completed_outputs() -> None:
    repository = FakeJobRepository()
    storage = FakeStorage()
    job_id = uuid4()
    await repository.create(
        job_id=job_id,
        owner_user_id="user-a",
        task_server_name="fpocket",
        task_name="detect_pockets",
        params={},
        params_schema_version=1,
    )
    service = JobOutputService(repository=repository, storage=storage)

    with pytest.raises(JobOutputNotFoundError):
        await service.mint_download_url("user-a", job_id, "annotated_structure")

    assert storage.downloaded_keys == []


async def test_mint_download_url_hides_an_output_with_an_unexpected_storage_key() -> None:
    repository = FakeJobRepository()
    storage = FakeStorage()
    job_id = uuid4()
    await repository.create(
        job_id=job_id,
        owner_user_id="user-a",
        task_server_name="fpocket",
        task_name="detect_pockets",
        params={},
        params_schema_version=1,
    )
    await repository.mark_completed(
        job_id,
        result={
            "outputs": [{"name": "annotated_structure", "storage_key": "untrusted/key"}],
            "value": {},
        },
    )
    service = JobOutputService(repository=repository, storage=storage)

    with pytest.raises(JobOutputNotFoundError):
        await service.mint_download_url("user-a", job_id, "annotated_structure")

    assert storage.downloaded_keys == []
