"""Validated production configuration for a synchronous Task Server."""
# ruff: noqa: TC003

from __future__ import annotations

from enum import StrEnum
from pathlib import Path

from pydantic import AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"


class LogLevel(StrEnum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class TaskServerSettings(BaseSettings):
    """Settings loaded from environment and a local `.env` file."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_environment: Environment = Environment.DEVELOPMENT
    log_level: LogLevel = LogLevel.INFO
    docs_enabled: bool | None = None
    gateway_internal_url: AnyHttpUrl
    gateway_task_hmac_secret: SecretStr = Field(min_length=32)
    seaweedfs_internal_endpoint: AnyHttpUrl
    seaweedfs_access_key: str
    seaweedfs_secret_key: SecretStr
    seaweedfs_bucket: str = "taskome"
    http_connect_timeout_seconds: float = Field(default=3, gt=0)
    http_io_timeout_seconds: float = Field(default=30, gt=0)
    seaweedfs_connect_timeout_seconds: float = Field(default=3, gt=0)
    seaweedfs_io_timeout_seconds: float = Field(default=30, gt=0)
    gateway_signature_max_age_seconds: int = Field(default=300, gt=0)
    workdir_root: Path | None = None
    max_concurrent_jobs: int = Field(default=1, gt=0)
    request_body_max_bytes: int = Field(default=4 * 1024 * 1024, gt=0)
    mcp_message_max_bytes: int = Field(default=1024 * 1024, gt=0)
    otel_service_name: str | None = None
    otel_exporter_otlp_endpoint: str | None = None
    otel_exporter_otlp_traces_endpoint: str | None = None
    otel_exporter_otlp_logs_endpoint: str | None = None
    otel_exporter_otlp_headers: str | None = None
    otel_exporter_otlp_traces_headers: str | None = None
    otel_exporter_otlp_logs_headers: str | None = None
