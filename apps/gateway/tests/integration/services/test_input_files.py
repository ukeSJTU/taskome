"""`InputFileService` wired to a real repository and real storage together.

Deliberately thin: repository SQL semantics are covered in
tests/integration/repositories/test_input_files.py, S3/presigned-URL semantics in
tests/integration/services/test_storage.py, and orchestration logic with fakes in
tests/unit/services/test_input_files.py. This file exists only to catch bugs at the
seam *between* those two real layers — the golden path, end to end.
"""

from __future__ import annotations

import asyncio
import urllib.error
import urllib.request
from typing import TYPE_CHECKING

import pytest
from gateway.repositories.input_files import InputFileRepository
from gateway.services.input_files import InputFileNotFoundError, InputFileService

if TYPE_CHECKING:
    from gateway.db.database import Database
    from gateway.services.storage import SeaweedFSStorage


@pytest.fixture
def service(database: Database, storage: SeaweedFSStorage) -> InputFileService:
    storage.ensure_bucket()
    return InputFileService(repository=InputFileRepository(database), storage=storage)


async def test_upload_download_delete_reaches_real_storage_and_database(
    service: InputFileService,
) -> None:
    uploaded = await service.mint_upload_url("user-a", "binder.pdb", len(b"ATOM 1 TEST"))
    put = urllib.request.Request(  # noqa: S310
        uploaded.upload_url,
        data=b"ATOM 1 TEST",
        headers={"If-None-Match": "*"},
        method="PUT",
    )
    with await asyncio.to_thread(urllib.request.urlopen, put) as response:
        assert response.status == 200

    downloaded = await service.mint_download_url("user-a", uploaded.id)
    with await asyncio.to_thread(urllib.request.urlopen, downloaded.download_url) as response:
        assert response.read() == b"ATOM 1 TEST"

    await service.delete("user-a", uploaded.id)

    with pytest.raises(InputFileNotFoundError):
        await service.mint_download_url("user-a", uploaded.id)


async def test_access_is_owner_scoped_end_to_end(service: InputFileService) -> None:
    uploaded = await service.mint_upload_url("user-a", "binder.pdb", 1024)

    with pytest.raises(InputFileNotFoundError):
        await service.mint_download_url("user-b", uploaded.id)
    with pytest.raises(InputFileNotFoundError):
        await service.delete("user-b", uploaded.id)

    # still available to its actual owner — the other user's attempts were no-ops
    downloaded = await service.mint_download_url("user-a", uploaded.id)
    assert downloaded.download_url
