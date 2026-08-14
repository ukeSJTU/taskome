"""Production Gateway HMAC, HTTP input resolution, and S3 output ports."""
# ruff: noqa: ANN401, EM101, PGH003, TC001, TC003, TRY003

from __future__ import annotations

import hashlib
import hmac
import time
from collections.abc import Collection, Mapping
from pathlib import Path
from typing import Any
from uuid import UUID

import boto3
import httpx
import structlog

from .runtime import (
    PublishedOutput,
    SignedGatewayRequest,
    TaskServerRuntime,
    ValidatedProducedFile,
    VerifiedGatewayRequest,
)
from .settings import TaskServerSettings
from .types import InputFileId


class GatewayHMACVerifier:
    def __init__(self, secret: str, max_age_seconds: int) -> None:
        self._secret = secret.encode()
        self._max_age_seconds = max_age_seconds

    def verify(self, request: SignedGatewayRequest) -> VerifiedGatewayRequest:
        if request.timestamp is None or request.signature is None:
            raise ValueError("missing Gateway signature")
        try:
            timestamp = int(request.timestamp)
        except ValueError as error:
            raise ValueError("invalid Gateway timestamp") from error
        if abs(time.time() - timestamp) > self._max_age_seconds:
            raise ValueError("expired Gateway signature")
        canonical = "\n".join(
            (
                "taskome-v1",
                request.timestamp,
                request.method.upper(),
                request.target,
                request.job_id or "",
                request.traceparent or "",
                hashlib.sha256(request.body).hexdigest(),
            )
        )
        expected = hmac.new(self._secret, canonical.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, request.signature):
            raise ValueError("invalid Gateway signature")
        return VerifiedGatewayRequest(
            job_id=UUID(request.job_id) if request.job_id else None,
            traceparent=request.traceparent,
        )


class GatewayInputFileResolver:
    def __init__(self, gateway_url: str, client: httpx.AsyncClient) -> None:
        self._gateway_url = gateway_url.rstrip("/")
        self._client = client

    async def materialize(
        self,
        job_id: UUID,
        input_file_ids: Collection[InputFileId],
        destination_dir: Path,
    ) -> Mapping[InputFileId, Path]:
        if not input_file_ids:
            return {}
        response = await self._client.post(
            f"{self._gateway_url}/internal/jobs/{job_id}/input-files/resolve",
            json={"input_file_ids": [str(identifier) for identifier in input_file_ids]},
        )
        response.raise_for_status()
        entries = response.json()["input_files"]
        resolved: dict[InputFileId, Path] = {}
        for entry in entries:
            identifier = InputFileId(entry["id"])
            path = destination_dir / str(identifier)
            partial = path.with_suffix(".part")
            written = 0
            async with self._client.stream("GET", entry["url"]) as download:
                download.raise_for_status()
                with partial.open("wb") as handle:
                    async for chunk in download.aiter_bytes():
                        written += len(chunk)
                        handle.write(chunk)
            if written != entry["size_bytes"]:
                partial.unlink(missing_ok=True)
                raise RuntimeError("Gateway Input File size did not match downloaded bytes")
            partial.replace(path)
            resolved[identifier] = path
        return resolved


class S3OutputPublisher:
    def __init__(self, client: Any, bucket: str, logger: structlog.stdlib.BoundLogger) -> None:
        self._client = client
        self._bucket = bucket
        self._logger = logger

    async def publish(
        self, server_name: str, job_id: UUID, files: Collection[ValidatedProducedFile]
    ) -> tuple[PublishedOutput, ...]:
        uploaded: list[str] = []
        outputs: list[PublishedOutput] = []
        try:
            for file in files:
                key = f"{server_name}/{job_id}/{file.name}"
                await __import__("anyio").to_thread.run_sync(  # type: ignore
                    self._client.upload_file,
                    str(file.path),
                    self._bucket,
                    key,
                    {"ExtraArgs": {"ContentType": file.media_type}},
                )
                uploaded.append(key)
                outputs.append(
                    PublishedOutput(
                        name=file.name,
                        storage_key=key,
                        media_type=file.media_type,
                        download_name=file.download_name,
                        size_bytes=file.size_bytes,
                        sha256=file.sha256,
                    )
                )
        except Exception:
            for key in reversed(uploaded):
                try:
                    await __import__("anyio").to_thread.run_sync(  # type: ignore
                        self._client.delete_object, Bucket=self._bucket, Key=key
                    )
                except Exception:
                    self._logger.exception("task_output_rollback_failed", storage_key=key)
            raise
        return tuple(outputs)


def build_runtime(settings: TaskServerSettings) -> TaskServerRuntime:
    """Construct the reusable production ports from validated settings."""
    timeout = httpx.Timeout(
        connect=settings.http_connect_timeout_seconds,
        read=settings.http_io_timeout_seconds,
        write=settings.http_io_timeout_seconds,
        pool=settings.http_io_timeout_seconds,
    )
    client = httpx.AsyncClient(timeout=timeout)
    logger = structlog.get_logger()
    s3 = boto3.client(
        "s3",
        endpoint_url=str(settings.seaweedfs_internal_endpoint),
        aws_access_key_id=settings.seaweedfs_access_key,
        aws_secret_access_key=settings.seaweedfs_secret_key.get_secret_value(),
    )
    return TaskServerRuntime(
        gateway_requests=GatewayHMACVerifier(
            settings.gateway_task_hmac_secret.get_secret_value(),
            settings.gateway_signature_max_age_seconds,
        ),
        input_files=GatewayInputFileResolver(str(settings.gateway_internal_url), client),
        outputs=S3OutputPublisher(s3, settings.seaweedfs_bucket, logger),
        logger=logger,
        workdir_root=settings.workdir_root,
        max_concurrent_jobs=settings.max_concurrent_jobs,
    )
