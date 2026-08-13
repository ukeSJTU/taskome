from __future__ import annotations

from datetime import UTC, datetime, timedelta

import boto3
from botocore.client import Config


class SeaweedFSStorage:
    def __init__(
        self,
        *,
        internal_endpoint: str,
        public_endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
    ) -> None:
        client_config = Config(signature_version="s3v4", s3={"addressing_style": "path"})
        self._internal = boto3.client(
            "s3",
            endpoint_url=internal_endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="us-east-1",
            config=client_config,
        )
        self._public = boto3.client(
            "s3",
            endpoint_url=public_endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="us-east-1",
            config=client_config,
        )
        self._bucket = bucket

    def ensure_bucket(self) -> None:
        try:
            self._internal.head_bucket(Bucket=self._bucket)
        except self._internal.exceptions.ClientError as error:
            if error.response.get("Error", {}).get("Code") not in {"404", "NoSuchBucket"}:
                raise
            self._internal.create_bucket(Bucket=self._bucket)

    def mint_upload_url(self, key: str, expires_in: int) -> tuple[str, datetime]:
        return self._presign("put_object", key, expires_in)

    def mint_download_url(self, key: str, expires_in: int) -> tuple[str, datetime]:
        return self._presign("get_object", key, expires_in)

    def delete(self, key: str) -> None:
        self._internal.delete_object(Bucket=self._bucket, Key=key)

    def _presign(self, operation: str, key: str, expires_in: int) -> tuple[str, datetime]:
        url = self._public.generate_presigned_url(
            operation,
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )
        return url, datetime.now(UTC) + timedelta(seconds=expires_in)
