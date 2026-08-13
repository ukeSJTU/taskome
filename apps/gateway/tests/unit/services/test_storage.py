from __future__ import annotations

from typing import TYPE_CHECKING

from gateway.services.storage import SeaweedFSStorage

if TYPE_CHECKING:
    from pytest_mock import MockerFixture


def test_close_releases_both_boto_clients(mocker: MockerFixture) -> None:
    internal = mocker.Mock()
    public = mocker.Mock()
    client_factory = mocker.patch(
        "gateway.services.storage.boto3.client",
        side_effect=[internal, public],
    )
    storage = SeaweedFSStorage(
        internal_endpoint="http://seaweedfs:8333",
        public_endpoint="https://files.example.test",
        access_key="test",
        secret_key="test-secret",  # noqa: S106 - inert unit-test credential
        bucket="taskome",
    )

    storage.close()

    assert client_factory.call_count == 2
    internal.close.assert_called_once_with()
    public.close.assert_called_once_with()
