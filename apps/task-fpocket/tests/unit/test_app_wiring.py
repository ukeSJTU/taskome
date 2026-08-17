"""Smoke test proving `fpocket_server.app` wires `build_task_server()` for real.

Unlike `test_detect_pockets.py` (which exercises the adapter through
`task_kit.testing.fake_runtime()`), this covers the one thing nothing else
touches: that `app.py`'s production `TaskServerSettings`/`build_runtime()`
wiring actually produces a working app, using the real Gateway HMAC scheme
(not the test-only secret `fake_runtime()` bakes in).
"""
# ruff: noqa: S105

from __future__ import annotations

import hashlib
import hmac
import time
from typing import TYPE_CHECKING

import pytest
from fastapi.testclient import TestClient

if TYPE_CHECKING:
    from types import ModuleType

_HMAC_SECRET = "task-fpocket-app-wiring-test-secret-32-bytes-min"


def _production_signature(
    *, secret: str, timestamp: str, method: str, target: str, body: bytes
) -> str:
    """Reproduce task-kit's production HMAC scheme (ADR-0007), by design not private-imported."""
    canonical = "\n".join(
        ("taskome-v1", timestamp, method.upper(), target, "", hashlib.sha256(body).hexdigest())
    )
    return hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()


@pytest.fixture
def app_module(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    monkeypatch.setenv("GATEWAY_INTERNAL_URL", "http://gateway.internal.test")
    monkeypatch.setenv("GATEWAY_TASK_HMAC_SECRET", _HMAC_SECRET)
    monkeypatch.setenv("SEAWEEDFS_INTERNAL_ENDPOINT", "http://seaweedfs.internal.test:8333")
    monkeypatch.setenv("SEAWEEDFS_ACCESS_KEY", "wiring-test-access-key")
    monkeypatch.setenv("SEAWEEDFS_SECRET_KEY", "wiring-test-secret-key")
    import fpocket_server.app as module  # noqa: PLC0415

    return module


def test_health_live_is_unsigned(app_module: ModuleType) -> None:
    with TestClient(app_module.app) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "live"}


def test_manifest_lists_detect_pockets_under_the_configured_hmac_secret(
    app_module: ModuleType,
) -> None:
    body = b""
    timestamp = str(int(time.time()))
    signature = _production_signature(
        secret=_HMAC_SECRET,
        timestamp=timestamp,
        method="GET",
        target="/internal/manifest",
        body=body,
    )

    with TestClient(app_module.app) as client:
        response = client.get(
            "/internal/manifest",
            headers={"X-Taskome-Timestamp": timestamp, "X-Taskome-Signature": signature},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["server_name"] == "fpocket"
    assert [task["name"] for task in payload["tasks"]] == ["detect_pockets"]
