from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from gateway.core.config import Environment, Settings
from pydantic import ValidationError

if TYPE_CHECKING:
    from pathlib import Path


def test_settings_use_application_local_environment_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("LOG_LEVEL", "WARNING")
    monkeypatch.setenv("DOCS_ENABLED", "false")

    settings = Settings(_env_file=None)

    assert settings.environment is Environment.TEST
    assert settings.log_level == "WARNING"
    assert settings.expose_docs is False


def test_invalid_log_level_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(log_level="verbose", _env_file=None)


def test_docs_default_to_disabled_only_in_production() -> None:
    assert Settings(environment=Environment.DEVELOPMENT, _env_file=None).expose_docs
    assert not Settings(environment=Environment.PRODUCTION, _env_file=None).expose_docs
    assert Settings(
        environment=Environment.PRODUCTION,
        docs_enabled=True,
        _env_file=None,
    ).expose_docs


def test_standard_otel_names_are_loaded_from_dotenv(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "OTEL_SERVICE_NAME=gateway-test\nOTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318\n",
    )

    settings = Settings(_env_file=env_file)

    assert settings.otel_service_name == "gateway-test"
    assert settings.otel_exporter_otlp_endpoint == "http://collector:4318"
