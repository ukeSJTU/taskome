"""Orchestration logic in `InputFileService`, isolated from Postgres and SeaweedFS.

Made possible by `InputFileRepositoryPort`/`StoragePort` (see gateway.services.input_files):
before those existed, this logic was only reachable through the two-container
integration test in tests/integration/services/test_input_files.py. Real S3/Postgres
semantics stay covered there; this file is about the service's own decisions.
"""

from __future__ import annotations

import pytest
from gateway.services.input_files import InputFileNotFoundError, InputFileService

from tests.unit.fakes import FakeInputFileRepository, FakeStorage


@pytest.fixture
def service() -> tuple[InputFileService, FakeInputFileRepository, FakeStorage]:
    repository = FakeInputFileRepository()
    storage = FakeStorage()
    return InputFileService(repository=repository, storage=storage), repository, storage


async def test_mint_upload_url_ensures_the_bucket_and_wraps_the_presigned_url(
    service: tuple[InputFileService, FakeInputFileRepository, FakeStorage],
) -> None:
    input_file_service, _repository, storage = service

    result = await input_file_service.mint_upload_url("user-a", "binder.pdb")

    assert storage.ensure_bucket_calls == 1
    assert storage.uploaded_keys == [f"uploads/{result.id}"]
    assert result.upload_url == f"http://fake-storage/upload/uploads/{result.id}"


async def test_mint_download_url_rejects_files_the_caller_does_not_own(
    service: tuple[InputFileService, FakeInputFileRepository, FakeStorage],
) -> None:
    input_file_service, _repository, storage = service
    uploaded = await input_file_service.mint_upload_url("user-a", "binder.pdb")

    with pytest.raises(InputFileNotFoundError):
        await input_file_service.mint_download_url("user-b", uploaded.id)

    assert storage.downloaded_keys == []


async def test_mint_download_url_mints_a_presigned_url_for_the_owner(
    service: tuple[InputFileService, FakeInputFileRepository, FakeStorage],
) -> None:
    input_file_service, _repository, storage = service
    uploaded = await input_file_service.mint_upload_url("user-a", "binder.pdb")

    result = await input_file_service.mint_download_url("user-a", uploaded.id)

    assert storage.downloaded_keys == [f"uploads/{uploaded.id}"]
    assert result.download_url == f"http://fake-storage/download/uploads/{uploaded.id}"


async def test_delete_removes_the_object_only_after_the_record_is_marked_deleted(
    service: tuple[InputFileService, FakeInputFileRepository, FakeStorage],
) -> None:
    input_file_service, _repository, storage = service
    uploaded = await input_file_service.mint_upload_url("user-a", "binder.pdb")

    await input_file_service.delete("user-a", uploaded.id)

    assert storage.deleted_keys == [f"uploads/{uploaded.id}"]
    with pytest.raises(InputFileNotFoundError):
        await input_file_service.mint_download_url("user-a", uploaded.id)


async def test_delete_of_a_file_the_caller_does_not_own_leaves_storage_untouched(
    service: tuple[InputFileService, FakeInputFileRepository, FakeStorage],
) -> None:
    input_file_service, _repository, storage = service
    uploaded = await input_file_service.mint_upload_url("user-a", "binder.pdb")

    with pytest.raises(InputFileNotFoundError):
        await input_file_service.delete("user-b", uploaded.id)

    assert storage.deleted_keys == []
