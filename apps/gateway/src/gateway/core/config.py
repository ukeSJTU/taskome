from enum import StrEnum
from importlib.metadata import version

from pydantic import AnyHttpUrl, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_MIN_INTERNAL_SECRET_LENGTH = 32
_HMAC_LENGTH_ERROR = "WEB_GATEWAY_HMAC_SECRET must be at least 32 characters"


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class LogLevel(StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


def distribution_version() -> str:
    return version("gateway")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "taskome-gateway"
    app_version: str = Field(default_factory=distribution_version)
    app_environment: Environment = Environment.DEVELOPMENT
    log_level: LogLevel = LogLevel.INFO
    docs_enabled: bool | None = None
    database_url: SecretStr
    rate_limit_redis_url: SecretStr = SecretStr("redis://localhost:6379/0")
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
        return self

    @property
    def expose_docs(self) -> bool:
        if self.docs_enabled is not None:
            return self.docs_enabled
        return self.app_environment is not Environment.PRODUCTION

    @property
    def resolved_seaweedfs_public_endpoint(self) -> str:
        return self.seaweedfs_public_endpoint or self.seaweedfs_internal_endpoint

    @property
    def auth_jwks_url(self) -> str:
        return f"{str(self.web_internal_url).rstrip('/')}/api/auth/jwks"

    @property
    def personal_api_key_verification_url(self) -> str:
        return f"{str(self.web_internal_url).rstrip('/')}/api/internal/personal-api-keys/verify"

    @property
    def auth_session_issuer(self) -> str:
        return str(self.better_auth_url).rstrip("/")

    @property
    def auth_oauth_issuer(self) -> str:
        return f"{str(self.better_auth_url).rstrip('/')}/api/auth"

    @property
    def rest_resource(self) -> str:
        return f"{str(self.gateway_public_url).rstrip('/')}/v1"

    @property
    def mcp_resource(self) -> str:
        return f"{str(self.gateway_public_url).rstrip('/')}/mcp"
