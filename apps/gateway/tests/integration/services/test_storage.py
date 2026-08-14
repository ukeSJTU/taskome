"""`SeaweedFSStorage` against a real S3-compatible backend.

Presigned-URL and conditional-write semantics only exist to be gotten wrong by a
real S3 implementation — a fake can't tell you whether `IfNoneMatch` was actually
honored. `InputFileService`'s orchestration logic is covered separately, with
fakes, in tests/unit/services/test_input_files.py.
"""

from __future__ import annotations

import urllib.error
import urllib.request
from typing import TYPE_CHECKING
from uuid import uuid4

import pytest

if TYPE_CHECKING:
    from gateway.services.storage import SeaweedFSStorage


def _key() -> str:
    return f"tests/{uuid4()}"


def test_upload_url_allows_the_configured_browser_origin(storage: SeaweedFSStorage) -> None:
    storage.ensure_bucket()
    upload_url, _expires_at = storage.mint_upload_url(_key(), 60, 10)

    preflight = urllib.request.Request(  # noqa: S310
        upload_url,
        method="OPTIONS",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "PUT",
        },
    )
    with urllib.request.urlopen(preflight) as response:  # noqa: S310
        assert response.status == 200
        assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"


def test_upload_url_rejects_a_put_without_the_condition_header(
    storage: SeaweedFSStorage,
) -> None:
    storage.ensure_bucket()
    upload_url, _expires_at = storage.mint_upload_url(_key(), 60, len(b"no condition header"))

    request = urllib.request.Request(upload_url, data=b"no condition header", method="PUT")  # noqa: S310
    with pytest.raises(urllib.error.HTTPError) as error:
        urllib.request.urlopen(request)  # noqa: S310
    assert error.value.code == 403


def test_upload_url_rejects_content_larger_than_the_declared_size(
    storage: SeaweedFSStorage,
) -> None:
    storage.ensure_bucket()
    upload_url, _expires_at = storage.mint_upload_url(_key(), 60, 4)
    request = urllib.request.Request(  # noqa: S310
        upload_url,
        data=b"12345",
        headers={"If-None-Match": "*"},
        method="PUT",
    )

    with pytest.raises(urllib.error.HTTPError) as error:
        urllib.request.urlopen(request)  # noqa: S310

    assert error.value.code == 403


def test_upload_url_rejects_overwriting_an_existing_object(storage: SeaweedFSStorage) -> None:
    storage.ensure_bucket()
    key = _key()
    first_upload_url, _expires_at = storage.mint_upload_url(key, 60, len(b"first"))
    first = urllib.request.Request(  # noqa: S310
        first_upload_url,
        data=b"first",
        headers={"If-None-Match": "*"},
        method="PUT",
    )
    with urllib.request.urlopen(first) as response:  # noqa: S310
        assert response.status == 200

    second_upload_url, _expires_at = storage.mint_upload_url(key, 60, len(b"second"))
    overwrite = urllib.request.Request(  # noqa: S310
        second_upload_url,
        data=b"second",
        headers={"If-None-Match": "*"},
        method="PUT",
    )
    with pytest.raises(urllib.error.HTTPError) as error:
        urllib.request.urlopen(overwrite)  # noqa: S310
    assert error.value.code == 412


def test_download_url_returns_the_uploaded_content(storage: SeaweedFSStorage) -> None:
    storage.ensure_bucket()
    key = _key()
    upload_url, _expires_at = storage.mint_upload_url(key, 60, len(b"ATOM 1 TEST"))
    upload = urllib.request.Request(  # noqa: S310
        upload_url,
        data=b"ATOM 1 TEST",
        headers={"If-None-Match": "*"},
        method="PUT",
    )
    with urllib.request.urlopen(upload) as response:  # noqa: S310
        assert response.status == 200

    download_url, _expires_at = storage.mint_download_url(key, 60)
    with urllib.request.urlopen(download_url) as response:  # noqa: S310
        assert response.read() == b"ATOM 1 TEST"


def test_delete_removes_the_object(storage: SeaweedFSStorage) -> None:
    storage.ensure_bucket()
    key = _key()
    upload_url, _expires_at = storage.mint_upload_url(key, 60, len(b"gone soon"))
    upload = urllib.request.Request(  # noqa: S310
        upload_url,
        data=b"gone soon",
        headers={"If-None-Match": "*"},
        method="PUT",
    )
    with urllib.request.urlopen(upload) as response:  # noqa: S310
        assert response.status == 200

    storage.delete(key)

    download_url, _expires_at = storage.mint_download_url(key, 60)
    with pytest.raises(urllib.error.HTTPError) as error:
        urllib.request.urlopen(download_url)  # noqa: S310
    assert error.value.code == 404
