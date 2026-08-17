"""Production Gateway HMAC, HTTP input resolution, and S3 output ports."""
# ruff: noqa: ANN401, EM101, PLR0913, TC003, TRY003, TRY301

from __future__ import annotations

import hashlib
import hmac
import json
import time
from collections.abc import Collection, Mapping
from functools import partial
from pathlib import Path
from types import MappingProxyType
from typing import TYPE_CHECKING, Any
from uuid import UUID

import boto3
import httpx
import structlog
from anyio import to_thread
from botocore.client import Config
from botocore.exceptions import ClientError
from opentelemetry import propagate
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

from ._logging import configure_logging
from ._observability import create_observability
from ._settings import Environment, TaskServerSettings
from ._types import InputFileId
from .runtime import (
    PublishedOutput,
    SignedGatewayRequest,
    TaskServerRuntime,
    ValidatedProducedFile,
    VerifiedGatewayRequest,
)

if TYPE_CHECKING:
    from opentelemetry.sdk._logs.export import LogRecordExporter
    from opentelemetry.sdk.trace.export import SpanExporter

MAX_INPUT_FILE_BYTES = 50 * 1024 * 1024


def _signature(
    secret: str,
    *,
    timestamp: str,
    method: str,
    target: str,
    job_id: str,
    body: bytes,
) -> str:
    canonical = "\n".join(
        (
            "taskome-v1",
            timestamp,
            method.upper(),
            target,
            job_id,
            hashlib.sha256(body).hexdigest(),
        )
    )
    return hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def sign_gateway_request(
    secret: str,
    *,
    method: str,
    target: str,
    body: bytes,
    job_id: UUID | None = None,
) -> dict[str, str]:
    """Build `taskome-v1` HMAC headers for a Gateway-originated internal request.

    The counterpart to `GatewayHMACVerifier.verify`: Gateway uses this to call a
    Task Server (dispatch, manifest fetch), and a Task Server uses it to call
    back into Gateway (Input File resolution) -- both directions share one
    canonical signing scheme (ADR-0007) defined in exactly this one place.
    """
    timestamp = str(int(time.time()))
    headers: dict[str, str] = {"X-Taskome-Timestamp": timestamp}
    if job_id is not None:
        headers["X-Taskome-Job-Id"] = str(job_id)
    propagate.inject(headers)
    headers["X-Taskome-Signature"] = _signature(
        secret,
        timestamp=timestamp,
        method=method,
        target=target,
        job_id=str(job_id) if job_id is not None else "",
        body=body,
    )
    return headers


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
    def __init__(self, gateway_url: str, secret: str, client: httpx.AsyncClient) -> None:
        self._gateway_url = gateway_url.rstrip("/")
        self._secret = secret
        self._client = client

    async def materialize(
        self,
        job_id: UUID,
        input_file_ids: Collection[InputFileId],
        destination_dir: Path,
    ) -> Mapping[InputFileId, Path]:
        if not input_file_ids:
            return {}
        target = f"/internal/jobs/{job_id}/input-files/resolve"
        body = json.dumps(
            {"input_file_ids": [str(identifier.root) for identifier in input_file_ids]},
            separators=(",", ":"),
        ).encode()
        headers = sign_gateway_request(
            self._secret,
            method="POST",
            target=target,
            body=body,
            job_id=job_id,
        )
        headers["content-type"] = "application/json"
        response = await self._client.post(
            f"{self._gateway_url}{target}",
            content=body,
            headers=headers,
        )
        response.raise_for_status()
        entries = response.json()["input_files"]
        resolved: dict[InputFileId, Path] = {}
        for entry in entries:
            identifier = InputFileId(entry["id"])
            if identifier not in input_file_ids or identifier in resolved:
                raise RuntimeError("Gateway returned unexpected Input File metadata")
            expected_size = entry["size_bytes"]
            if not isinstance(expected_size, int) or not 0 < expected_size <= MAX_INPUT_FILE_BYTES:
                raise RuntimeError("Gateway returned an invalid Input File size")
            path = destination_dir / str(identifier.root)
            partial = path.with_suffix(".part")
            written = 0
            try:
                async with self._client.stream("GET", entry["url"]) as download:
                    download.raise_for_status()
                    with partial.open("wb") as handle:
                        async for chunk in download.aiter_bytes():
                            written += len(chunk)
                            if written > expected_size:
                                raise RuntimeError("Input File exceeded its declared size")
                            handle.write(chunk)
                if written != expected_size:
                    raise RuntimeError("Gateway Input File size did not match downloaded bytes")
                partial.replace(path)
            except Exception:
                partial.unlink(missing_ok=True)
                raise
            resolved[identifier] = path
        if set(resolved) != set(input_file_ids):
            raise RuntimeError("Gateway omitted requested Input File metadata")
        return MappingProxyType(resolved)


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
                await to_thread.run_sync(self._put_file, key, file)
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
                    await to_thread.run_sync(
                        partial(self._client.delete_object, Bucket=self._bucket, Key=key)
                    )
                except Exception:
                    self._logger.exception("task_output_rollback_failed", storage_key=key)
            raise
        return tuple(outputs)

    def _put_file(self, key: str, file: ValidatedProducedFile) -> None:
        # SeaweedFS 3.93 does not enforce S3 conditional PUT. The v1 deployment
        # contract permits only one process/replica and stop-then-start rollout,
        # while claim_job serializes duplicate job ids inside that process, so a
        # preflight existence check is the compatible non-overwrite boundary.
        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") not in {"404", "NoSuchKey"}:
                raise
        else:
            raise FileExistsError(key)
        with file.path.open("rb") as body:
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=body,
                ContentType=file.media_type,
                IfNoneMatch="*",
            )


def build_runtime(
    settings: TaskServerSettings,
    *,
    span_exporter: SpanExporter | None = None,
    log_exporter: LogRecordExporter | None = None,
) -> TaskServerRuntime:
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
        region_name="us-east-1",
        config=Config(
            signature_version="s3v4",
            connect_timeout=settings.seaweedfs_connect_timeout_seconds,
            read_timeout=settings.seaweedfs_io_timeout_seconds,
            retries={"mode": "standard", "total_max_attempts": 1},
            s3={"addressing_style": "path"},
        ),
    )

    async def start(app: object, server_name: str) -> None:
        del app
        runtime.observability = create_observability(
            settings,
            server_name,
            span_exporter=span_exporter,
            log_exporter=log_exporter,
        )
        configure_logging(settings, runtime.observability.logger_provider)
        HTTPXClientInstrumentor.instrument_client(
            client,
            tracer_provider=runtime.observability.tracer_provider,
            request_hook=_redact_httpx_query,
        )

    async def close() -> None:
        HTTPXClientInstrumentor.uninstrument_client(client)
        await client.aclose()
        await to_thread.run_sync(s3.close)
        if runtime.observability is not None:
            await runtime.observability.shutdown()

    runtime = TaskServerRuntime(
        gateway_requests=GatewayHMACVerifier(
            settings.gateway_task_hmac_secret.get_secret_value(),
            settings.gateway_signature_max_age_seconds,
        ),
        input_files=GatewayInputFileResolver(
            str(settings.gateway_internal_url),
            settings.gateway_task_hmac_secret.get_secret_value(),
            client,
        ),
        outputs=S3OutputPublisher(s3, settings.seaweedfs_bucket, logger),
        logger=logger,
        workdir_root=settings.workdir_root,
        max_concurrent_jobs=settings.max_concurrent_jobs,
        request_body_max_bytes=settings.request_body_max_bytes,
        mcp_message_max_bytes=settings.mcp_message_max_bytes,
        docs_enabled=(
            settings.app_environment is Environment.DEVELOPMENT
            if settings.docs_enabled is None
            else settings.docs_enabled
        ),
        start=start,
        close=close,
    )
    return runtime


async def _redact_httpx_query(span: Any, request: Any) -> None:
    if not span.is_recording():
        return
    safe_url = str(request.url.copy_with(query=None))
    span.set_attribute("url.full", safe_url)
    span.set_attribute("http.url", safe_url)
