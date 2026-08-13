from __future__ import annotations

from pathlib import Path

import pytest
from gateway.core.config import Environment, Settings
from pydantic import ValidationError


def test_settings_use_application_local_environment_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENVIRONMENT", "test")
    monkeypatch.setenv("LOG_LEVEL", "WARNING")
    monkeypatch.setenv("DOCS_ENABLED", "false")

    settings = Settings(_env_file=None)

    assert settings.app_environment is Environment.TEST
    assert settings.log_level == "WARNING"
    assert settings.expose_docs is False


def test_invalid_log_level_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(log_level="verbose", _env_file=None)


def test_docs_default_to_disabled_only_in_production() -> None:
    assert Settings(app_environment=Environment.DEVELOPMENT, _env_file=None).expose_docs
    assert not Settings(app_environment=Environment.PRODUCTION, _env_file=None).expose_docs
    assert Settings(
        app_environment=Environment.PRODUCTION,
        docs_enabled=True,
        _env_file=None,
    ).expose_docs


def test_seaweedfs_public_endpoint_defaults_to_internal_endpoint() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://test:test@localhost:5432/test",
        seaweedfs_internal_endpoint="http://seaweedfs:8333",
        _env_file=None,
    )

    assert settings.resolved_seaweedfs_public_endpoint == "http://seaweedfs:8333"


def test_seaweedfs_public_endpoint_can_differ_from_internal_endpoint() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://test:test@localhost:5432/test",
        seaweedfs_internal_endpoint="http://seaweedfs:8333",
        seaweedfs_public_endpoint="https://files.example.test",
        _env_file=None,
    )

    assert settings.resolved_seaweedfs_public_endpoint == "https://files.example.test"


def test_standard_otel_names_are_loaded_from_dotenv(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "OTEL_SERVICE_NAME=gateway-test\nOTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318\n",
    )

    settings = Settings(_env_file=env_file)

    assert settings.otel_service_name == "gateway-test"
    assert settings.otel_exporter_otlp_endpoint == "http://collector:4318"


def test_checked_in_env_example_matches_gateway_settings() -> None:
    env_example = Path(__file__).parents[1] / ".env.example"

    settings = Settings(_env_file=env_example)
    uncommented_keys = {
        line.partition("=")[0]
        for line in env_example.read_text().splitlines()
        if line and not line.startswith("#") and "=" in line
    }

    assert settings.otel_exporter_otlp_endpoint is None
    assert {key.lower() for key in uncommented_keys} <= Settings.model_fields.keys()
