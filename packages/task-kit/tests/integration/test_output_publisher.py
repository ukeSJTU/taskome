# ruff: noqa: A002, EM101, N803, PLR2004, S101, S106, TC003, TRY003

from __future__ import annotations

import json
import os
import socket
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

import boto3
import pytest
import structlog
from botocore.exceptions import BotoCoreError, ClientError
from task_kit.runtime import (
    S3OutputPublisher,
    TaskServerSettings,
    ValidatedProducedFile,
    build_runtime,
)
from testcontainers.core.container import DockerContainer
from testcontainers.core.wait_strategies import HttpWaitStrategy

if TYPE_CHECKING:
    from collections.abc import Iterator

    from botocore.client import BaseClient


class FailingS3Client:
    def __init__(self) -> None:
        self.deleted: list[str] = []
        self.writes = 0

    def put_object(self, **kwargs: object) -> None:
        del kwargs
        self.writes += 1
        if self.writes == 2:
            raise RuntimeError("storage unavailable")

    def head_object(self, *, Bucket: str, Key: str) -> None:
        del Bucket, Key
        raise ClientError({"Error": {"Code": "404"}}, "HeadObject")

    def delete_object(self, *, Bucket: str, Key: str) -> None:
        del Bucket
        self.deleted.append(Key)


class DroppedPutHandler(BaseHTTPRequestHandler):
    requests = 0
    if_none_match: str | None = None

    def do_PUT(self) -> None:
        type(self).requests += 1
        type(self).if_none_match = self.headers.get("if-none-match")
        content_length = int(self.headers.get("content-length", "0"))
        self.rfile.read(content_length)
        self.connection.shutdown(socket.SHUT_RDWR)
        self.close_connection = True

    def do_HEAD(self) -> None:
        self.send_response(404)
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        del format, args


@pytest.fixture(scope="module")
def seaweedfs_endpoint() -> Iterator[str]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as config_file:
        json.dump(
            {
                "identities": [
                    {
                        "name": "task-kit-test",
                        "credentials": [
                            {
                                "accessKey": "task-kit-test",
                                "secretKey": "task-kit-test",
                            }
                        ],
                        "actions": ["Read", "Write", "List", "Tagging", "Admin"],
                    }
                ]
            },
            config_file,
        )
        config_file.flush()
        os.fchmod(config_file.fileno(), 0o644)
        with (
            DockerContainer(
                "chrislusf/seaweedfs:3.93",
                command="server -dir=/data -s3 -s3.config=/etc/seaweedfs/s3-config.json",
            )
            .with_exposed_ports(8333)
            .waiting_for(HttpWaitStrategy(8333, "/status").with_startup_timeout(90))
            .with_volume_mapping(config_file.name, "/etc/seaweedfs/s3-config.json") as seaweedfs
        ):
            yield f"http://{seaweedfs.get_container_host_ip()}:{seaweedfs.get_exposed_port(8333)}"


@pytest.mark.asyncio
async def test_output_publication_rolls_back_already_written_objects(tmp_path: Path) -> None:
    first, second = tmp_path / "first.txt", tmp_path / "second.txt"
    first.write_text("first")
    second.write_text("second")
    files = (
        ValidatedProducedFile("first", first, "text/plain", None, 5, "a" * 64),
        ValidatedProducedFile("second", second, "text/plain", None, 6, "b" * 64),
    )
    client = FailingS3Client()
    publisher = S3OutputPublisher(client, "taskome", structlog.get_logger())

    with pytest.raises(RuntimeError, match="storage unavailable"):
        await publisher.publish("echo", UUID("00000000-0000-0000-0000-000000000006"), files)

    assert client.deleted == ["echo/00000000-0000-0000-0000-000000000006/first"]


@pytest.mark.asyncio
async def test_output_publication_does_not_retry_an_ambiguous_put(tmp_path: Path) -> None:
    DroppedPutHandler.requests = 0
    DroppedPutHandler.if_none_match = None
    server = ThreadingHTTPServer(("127.0.0.1", 0), DroppedPutHandler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    endpoint = f"http://127.0.0.1:{server.server_port}"
    runtime = build_runtime(
        TaskServerSettings(
            gateway_internal_url="https://gateway.test",
            gateway_task_hmac_secret="0123456789abcdef0123456789abcdef",
            seaweedfs_internal_endpoint=endpoint,
            seaweedfs_access_key="task-server",
            seaweedfs_secret_key="task-server-secret",
        )
    )
    path = tmp_path / "result.txt"
    path.write_text("result")
    file = ValidatedProducedFile("result", path, "text/plain", None, 6, "c" * 64)

    try:
        with pytest.raises(BotoCoreError):
            await runtime.outputs.publish(
                "echo",
                UUID("00000000-0000-0000-0000-000000000021"),
                (file,),
            )
    finally:
        if runtime.close is not None:
            await runtime.close()
        server.shutdown()
        thread.join()
        server.server_close()

    assert DroppedPutHandler.requests == 1
    assert DroppedPutHandler.if_none_match == "*"


def _seaweedfs_client(endpoint: str, bucket: str) -> BaseClient:
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id="task-kit-test",
        aws_secret_access_key="task-kit-test",
        region_name="us-east-1",
    )
    client.create_bucket(Bucket=bucket)
    return client


@pytest.mark.asyncio
async def test_output_publication_does_not_overwrite_in_real_seaweedfs(
    tmp_path: Path,
    seaweedfs_endpoint: str,
) -> None:
    bucket = f"task-kit-{uuid4().hex}"
    client = _seaweedfs_client(seaweedfs_endpoint, bucket)
    path = tmp_path / "result.txt"
    path.write_text("result")
    publisher = S3OutputPublisher(client, bucket, structlog.get_logger())
    job_id = UUID("00000000-0000-0000-0000-000000000010")
    file = ValidatedProducedFile("result", path, "text/plain", None, 6, "c" * 64)

    output = await publisher.publish("echo", job_id, (file,))

    assert output[0].storage_key.endswith("/result")
    stored = client.get_object(Bucket=bucket, Key=output[0].storage_key)
    assert stored["Body"].read() == b"result"
    with pytest.raises(FileExistsError):
        await publisher.publish("echo", job_id, (file,))


@pytest.mark.asyncio
async def test_output_publication_rolls_back_real_seaweedfs_writes(
    tmp_path: Path,
    seaweedfs_endpoint: str,
) -> None:
    bucket = f"task-kit-{uuid4().hex}"
    client = _seaweedfs_client(seaweedfs_endpoint, bucket)
    job_id = UUID("00000000-0000-0000-0000-000000000022")
    client.put_object(Bucket=bucket, Key=f"echo/{job_id}/second", Body=b"existing")
    first, second = tmp_path / "first.txt", tmp_path / "second.txt"
    first.write_text("first")
    second.write_text("second")
    publisher = S3OutputPublisher(client, bucket, structlog.get_logger())

    with pytest.raises(FileExistsError):
        await publisher.publish(
            "echo",
            job_id,
            (
                ValidatedProducedFile("first", first, "text/plain", None, 5, "a" * 64),
                ValidatedProducedFile("second", second, "text/plain", None, 6, "b" * 64),
            ),
        )

    with pytest.raises(ClientError) as missing:
        client.get_object(Bucket=bucket, Key=f"echo/{job_id}/first")
    assert missing.value.response["Error"]["Code"] == "NoSuchKey"
    existing = client.get_object(Bucket=bucket, Key=f"echo/{job_id}/second")
    assert existing["Body"].read() == b"existing"
