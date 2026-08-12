from enum import StrEnum
from importlib.metadata import version

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    environment: Environment = Environment.DEVELOPMENT
    log_level: LogLevel = LogLevel.INFO
    docs_enabled: bool | None = None
    database_url: SecretStr
    otel_service_name: str | None = None
    otel_exporter_otlp_endpoint: str | None = None
    otel_exporter_otlp_traces_endpoint: str | None = None
    otel_exporter_otlp_logs_endpoint: str | None = None
    otel_exporter_otlp_headers: str | None = None
    otel_exporter_otlp_traces_headers: str | None = None
    otel_exporter_otlp_logs_headers: str | None = None

    @property
    def expose_docs(self) -> bool:
        if self.docs_enabled is not None:
            return self.docs_enabled
        return self.environment is not Environment.PRODUCTION
