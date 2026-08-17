"""Validated Gateway runtime settings and dependency budgets."""

from dataclasses import dataclass
from enum import StrEnum
from importlib.metadata import version
from typing import Annotated

from pydantic import AnyHttpUrl, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_MIN_INTERNAL_SECRET_LENGTH = 32
_HMAC_LENGTH_ERROR = "WEB_GATEWAY_HMAC_SECRET must be at least 32 characters"
_FPOCKET_HMAC_LENGTH_ERROR = "FPOCKET_TASK_HMAC_SECRET must be at least 32 characters"


@dataclass(frozen=True, slots=True)
class TaskServerConfig:
    """Where and how to reach one registered Task Server (ADR-0007)."""

    base_url: str
    hmac_secret: str


class Environment(StrEnum):
    """Supported Gateway deployment environments."""

    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class LogLevel(StrEnum):
    """Supported structured-log thresholds."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


def distribution_version() -> str:
    """Return the installed Gateway distribution version."""

    return version("gateway")


class Settings(BaseSettings):
    """Runtime configuration for Gateway resources and boundary limits."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "taskome-gateway"
    app_version: Annotated[str, Field(default_factory=distribution_version)]
    app_environment: Environment = Environment.DEVELOPMENT
    log_level: LogLevel = LogLevel.INFO
    docs_enabled: bool | None = None
    database_url: SecretStr
    redis_url: SecretStr = SecretStr("redis://localhost:6379/0")
    ray_address: str = "ray://localhost:10001"
    database_timeout_seconds: Annotated[float, Field(gt=0)] = 5
    redis_timeout_seconds: Annotated[float, Field(gt=0)] = 2
    seaweedfs_connect_timeout_seconds: Annotated[float, Field(gt=0)] = 3
    seaweedfs_io_timeout_seconds: Annotated[float, Field(gt=0)] = 10
    jwks_timeout_seconds: Annotated[float, Field(gt=0)] = 5
    otel_shutdown_timeout_seconds: Annotated[float, Field(gt=0)] = 5
    request_body_max_bytes: Annotated[int, Field(gt=0)] = 4 * 1024 * 1024
    mcp_message_max_bytes: Annotated[int, Field(gt=0)] = 1024 * 1024
    seaweedfs_internal_endpoint: str = "http://localhost:8333"
    seaweedfs_public_endpoint: str | None = None
    seaweedfs_access_key: str = "taskome-dev"
    # Local credentials belong in .env; this placeholder must not authenticate
    # against the checked-in SeaweedFS development identity.
    seaweedfs_secret_key: SecretStr = SecretStr("unset")
    seaweedfs_bucket: str = "taskome"
    better_auth_url: AnyHttpUrl = AnyHttpUrl("http://localhost:3000")
    web_internal_url: AnyHttpUrl = AnyHttpUrl("http://localhost:3000")
    gateway_public_url: AnyHttpUrl = AnyHttpUrl("http://localhost:8000")
    web_gateway_hmac_secret: SecretStr = SecretStr("unset")
    fpocket_internal_url: AnyHttpUrl = AnyHttpUrl("http://localhost:18000")
    fpocket_task_hmac_secret: SecretStr = SecretStr("unset")
    otel_service_name: str | None = None
    otel_exporter_otlp_endpoint: str | None = None
    # Signal-specific endpoints and headers are read reflectively by
    # observability.py's _otlp_endpoint/_otlp_headers helpers, parameterized by
    # OtelSignal. Keep these fields even though direct references are not grep-visible.
    otel_exporter_otlp_traces_endpoint: str | None = None
    otel_exporter_otlp_logs_endpoint: str | None = None
    otel_exporter_otlp_headers: str | None = None
    otel_exporter_otlp_traces_headers: str | None = None
    otel_exporter_otlp_logs_headers: str | None = None

    @model_validator(mode="after")
    def require_production_internal_secret(self) -> Settings:
        if (
            self.app_environment is Environment.PRODUCTION
            and len(self.web_gateway_hmac_secret.get_secret_value()) < _MIN_INTERNAL_SECRET_LENGTH
        ):
            raise ValueError(_HMAC_LENGTH_ERROR)
        if (
            self.app_environment is Environment.PRODUCTION
            and len(self.fpocket_task_hmac_secret.get_secret_value()) < _MIN_INTERNAL_SECRET_LENGTH
        ):
            raise ValueError(_FPOCKET_HMAC_LENGTH_ERROR)
        return self

    @property
    def task_servers(self) -> dict[str, TaskServerConfig]:
        """Static registry of reachable Task Servers, keyed by server name."""

        return {
            "fpocket": TaskServerConfig(
                base_url=str(self.fpocket_internal_url).rstrip("/"),
                hmac_secret=self.fpocket_task_hmac_secret.get_secret_value(),
            ),
        }

    @property
    def expose_docs(self) -> bool:
        """Expose developer reference pages outside production unless overridden."""

        if self.docs_enabled is not None:
            return self.docs_enabled
        return self.app_environment is not Environment.PRODUCTION

    @property
    def resolved_seaweedfs_public_endpoint(self) -> str:
        """Return the caller-visible storage endpoint."""

        return self.seaweedfs_public_endpoint or self.seaweedfs_internal_endpoint

    @property
    def auth_jwks_url(self) -> str:
        """Return the internal Better Auth JWKS endpoint."""

        return f"{str(self.web_internal_url).rstrip('/')}/api/auth/jwks"

    @property
    def personal_api_key_verification_url(self) -> str:
        return f"{str(self.web_internal_url).rstrip('/')}/api/internal/personal-api-keys/verify"

    @property
    def auth_session_issuer(self) -> str:
        """Return the canonical issuer for Web session JWTs."""

        return str(self.better_auth_url).rstrip("/")

    @property
    def auth_oauth_issuer(self) -> str:
        """Return the canonical issuer for MCP OAuth access tokens."""

        return f"{str(self.better_auth_url).rstrip('/')}/api/auth"

    @property
    def rest_resource(self) -> str:
        """Return the public REST audience identifier."""

        return f"{str(self.gateway_public_url).rstrip('/')}/v1"

    @property
    def mcp_resource(self) -> str:
        """Return the public MCP resource identifier."""

        return f"{str(self.gateway_public_url).rstrip('/')}/mcp"
