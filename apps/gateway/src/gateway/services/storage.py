"""SeaweedFS S3 operations with bounded clients and signed upload constraints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import boto3
from botocore.client import Config


class SeaweedFSStorage:
    """Own synchronous S3 clients for SeaweedFS object operations."""

    def __init__(  # noqa: PLR0913 - explicit S3 connection policy is clearer at this boundary.
        self,
        *,
        internal_endpoint: str,
        public_endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        connect_timeout: float = 3,
        io_timeout: float = 10,
        defer_start: bool = False,
    ) -> None:
        """Configure bounded internal and presigning S3 clients.

        Args:
            internal_endpoint: Service-network endpoint for direct S3 operations.
            public_endpoint: Caller-visible endpoint embedded in presigned URLs.
            access_key: Gateway's scoped S3 access key.
            secret_key: Gateway's scoped S3 secret key.
            bucket: Gateway-owned Input File bucket.
            connect_timeout: TCP connection budget in seconds.
            io_timeout: Read/write budget in seconds.
            defer_start: Delay boto3 allocation until lifespan startup.
        """

        self._internal_endpoint = internal_endpoint
        self._public_endpoint = public_endpoint
        self._access_key = access_key
        self._secret_key = secret_key
        self._client_config = Config(
            signature_version="s3v4",
            connect_timeout=connect_timeout,
            read_timeout=io_timeout,
            retries={"mode": "standard", "total_max_attempts": 2},
            s3={"addressing_style": "path"},
        )
        self._internal: Any = None
        self._public: Any = None
        self._bucket = bucket
        if not defer_start:
            self.start()

    def start(self) -> None:
        """Construct both boto3 clients during application startup."""

        if self._internal is not None:
            return
        self._internal = boto3.client(
            "s3",
            endpoint_url=self._internal_endpoint,
            aws_access_key_id=self._access_key,
            aws_secret_access_key=self._secret_key,
            region_name="us-east-1",
            config=self._client_config,
        )
        self._public = boto3.client(
            "s3",
            endpoint_url=self._public_endpoint,
            aws_access_key_id=self._access_key,
            aws_secret_access_key=self._secret_key,
            region_name="us-east-1",
            config=self._client_config,
        )

    def close(self) -> None:
        """Close both internal and public boto3 connection pools."""

        if self._public is not None:
            self._public.close()
        if self._internal is not None:
            self._internal.close()
        self._public = None
        self._internal = None

    def ensure_bucket(self) -> None:
        """Create the configured bucket when it does not exist.

        Raises:
            ClientError: If storage fails for a reason other than a missing bucket.
        """

        try:
            self._internal.head_bucket(Bucket=self._bucket)
        except self._internal.exceptions.ClientError as error:
            if error.response.get("Error", {}).get("Code") not in {"404", "NoSuchBucket"}:
                raise
            self._internal.create_bucket(Bucket=self._bucket)

    def mint_upload_url(
        self,
        key: str,
        expires_in: int,
        size_bytes: int,
    ) -> tuple[str, datetime]:
        """Mint a PUT URL bound to exact length and no-overwrite semantics.

        Args:
            key: Server-controlled object key.
            expires_in: URL lifetime in seconds.
            size_bytes: Exact signed Content-Length.

        Returns:
            The presigned URL and its absolute expiry.
        """

        return self._presign(
            "put_object",
            key,
            expires_in,
            params={"IfNoneMatch": "*", "ContentLength": size_bytes},
        )

    def mint_download_url(self, key: str, expires_in: int) -> tuple[str, datetime]:
        """Mint a short-lived GET URL for one storage key.

        Args:
            key: Server-controlled object key.
            expires_in: URL lifetime in seconds.

        Returns:
            The presigned URL and its absolute expiry.
        """

        return self._presign("get_object", key, expires_in)

    def delete(self, key: str) -> None:
        """Delete one object by its server-controlled key.

        Args:
            key: Server-controlled object key.
        """

        self._internal.delete_object(Bucket=self._bucket, Key=key)

    def _presign(
        self,
        operation: str,
        key: str,
        expires_in: int,
        *,
        params: dict[str, str | int] | None = None,
    ) -> tuple[str, datetime]:
        request_params = {"Bucket": self._bucket, "Key": key}
        if params is not None:
            request_params.update(params)
        url = self._public.generate_presigned_url(
            operation,
            Params=request_params,
            ExpiresIn=expires_in,
        )
        return url, datetime.now(UTC) + timedelta(seconds=expires_in)
