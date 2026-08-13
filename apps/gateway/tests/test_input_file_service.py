from __future__ import annotations

import asyncio
import json
import tempfile
import urllib.error
import urllib.request
from typing import TYPE_CHECKING

import pytest
from gateway.db.database import Database
from gateway.db.models import metadata
from gateway.repositories.input_files import InputFileRepository
from gateway.services.input_files import (
    InputFileNotFoundError,
    InputFileService,
)
from gateway.services.storage import SeaweedFSStorage
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from testcontainers.core.container import DockerContainer
from testcontainers.core.wait_strategies import HttpWaitStrategy
from testcontainers.postgres import PostgresContainer

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture(scope="module")
def input_file_service() -> Iterator[InputFileService]:
    with PostgresContainer("postgres:18") as postgres:
        database_url = postgres.get_connection_url().replace(
            "postgresql+psycopg2", "postgresql+psycopg"
        )
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as config_file:
            json.dump(
                {
                    "identities": [
                        {
                            "name": "test",
                            "credentials": [
                                {
                                    "accessKey": "test-access-key",
                                    "secretKey": "test-secret-key",
                                }
                            ],
                            "actions": ["Read", "Write", "List", "Tagging", "Admin"],
                        }
                    ]
                },
                config_file,
            )
            config_file.flush()
            with (
                DockerContainer(
                    "chrislusf/seaweedfs:latest",
                    command=(
                        "server -dir=/data -s3 "
                        "-s3.config=/etc/seaweedfs/s3-config.json "
                        "-s3.allowedOrigins=http://localhost:3001"
                    ),
                )
                .with_exposed_ports(8333)
                .waiting_for(HttpWaitStrategy(8333, "/status").with_startup_timeout(90))
                .with_volume_mapping(
                    config_file.name,
                    "/etc/seaweedfs/s3-config.json",
                ) as seaweedfs
            ):
                endpoint = (
                    f"http://{seaweedfs.get_container_host_ip()}:{seaweedfs.get_exposed_port(8333)}"
                )
                database = Database(database_url)
                asyncio.run(_create_schema(database_url))
                yield InputFileService(
                    repository=InputFileRepository(database),
                    storage=SeaweedFSStorage(
                        internal_endpoint=endpoint,
                        public_endpoint=endpoint,
                        access_key="test-access-key",
                        secret_key="test-secret-key",  # noqa: S106
                        bucket="taskome-test",
                    ),
                )
                asyncio.run(database.dispose())


async def _create_schema(database_url: str) -> None:
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("CREATE SCHEMA gateway"))
            await connection.run_sync(metadata.create_all)
    finally:
        await engine.dispose()


def test_input_file_upload_and_download_use_seaweedfs(
    input_file_service: InputFileService,
) -> None:
    uploaded = asyncio.run(input_file_service.mint_upload_url("user-a", "binder.pdb"))
    preflight = urllib.request.Request(  # noqa: S310
        uploaded.upload_url,
        method="OPTIONS",
        headers={
            "Origin": "http://localhost:3001",
            "Access-Control-Request-Method": "PUT",
        },
    )
    with urllib.request.urlopen(preflight) as response:  # noqa: S310
        assert response.status == 200
        assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3001"

    missing_condition = urllib.request.Request(  # noqa: S310
        uploaded.upload_url,
        data=b"missing-condition",
        method="PUT",
    )
    with pytest.raises(urllib.error.HTTPError) as error:
        urllib.request.urlopen(missing_condition)  # noqa: S310
    assert error.value.code == 403

    request = urllib.request.Request(  # noqa: S310
        uploaded.upload_url,
        data=b"ATOM 1 TEST",
        headers={"If-None-Match": "*"},
        method="PUT",
    )
    with urllib.request.urlopen(request) as response:  # noqa: S310
        assert response.status == 200

    overwrite = urllib.request.Request(  # noqa: S310
        uploaded.upload_url,
        data=b"OVERWRITTEN",
        headers={"If-None-Match": "*"},
        method="PUT",
    )
    with pytest.raises(urllib.error.HTTPError) as error:
        urllib.request.urlopen(overwrite)  # noqa: S310
    assert error.value.code == 412

    downloaded = asyncio.run(input_file_service.mint_download_url("user-a", uploaded.id))
    with urllib.request.urlopen(downloaded.download_url) as response:  # noqa: S310
        assert response.read() == b"ATOM 1 TEST"


def test_deleted_input_file_is_unavailable_to_its_owner(
    input_file_service: InputFileService,
) -> None:
    uploaded = asyncio.run(input_file_service.mint_upload_url("user-a", "binder.pdb"))
    request = urllib.request.Request(  # noqa: S310
        uploaded.upload_url,
        data=b"old",
        headers={"If-None-Match": "*"},
        method="PUT",
    )
    with urllib.request.urlopen(request) as response:  # noqa: S310
        assert response.status == 200

    asyncio.run(input_file_service.delete("user-a", uploaded.id))

    with pytest.raises(InputFileNotFoundError):
        asyncio.run(input_file_service.mint_download_url("user-a", uploaded.id))
    with pytest.raises(InputFileNotFoundError):
        asyncio.run(input_file_service.delete("user-a", uploaded.id))


def test_input_file_access_is_owner_scoped_and_ids_are_immutable(
    input_file_service: InputFileService,
) -> None:
    first = asyncio.run(input_file_service.mint_upload_url("user-a", "binder.pdb"))
    second = asyncio.run(input_file_service.mint_upload_url("user-a", "binder.pdb"))
    assert first.id != second.id

    with pytest.raises(InputFileNotFoundError):
        asyncio.run(input_file_service.mint_download_url("user-b", first.id))
    with pytest.raises(InputFileNotFoundError):
        asyncio.run(input_file_service.delete("user-b", first.id))
