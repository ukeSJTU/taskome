from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from fastapi.testclient import TestClient

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI
    from pytest_mock import MockerFixture


def test_lifespan_starts_and_closes_owned_resources_exactly_once(
    create_test_app: Callable[..., FastAPI],
    mocker: MockerFixture,
) -> None:
    events: list[str] = []

    class Database:
        def start(self, *, tracer_provider: object | None = None) -> None:  # noqa: ARG002
            events.append("database.start")

        async def dispose(self) -> None:
            events.append("database.dispose")

    class Storage:
        def start(self) -> None:
            events.append("storage.start")

        def close(self) -> None:
            events.append("storage.close")

    class Redis:
        async def ping(self) -> bool:
            return True

        async def aclose(self) -> None:
            events.append("redis.close")

    class HTTPClient:
        async def aclose(self) -> None:
            events.append("jwks.close")

    class Verifier:
        def start(self, client: HTTPClient) -> None:
            assert isinstance(client, HTTPClient)
            events.append("verifier.start")

    http_client = HTTPClient()
    mocker.patch("gateway.core.lifespan.httpx2.AsyncClient", return_value=http_client)
    app = create_test_app()
    app.state.database = Database()
    app.state.storage = Storage()
    app.state.redis = Redis()
    app.state.managed_token_verifiers = (Verifier(),)

    with TestClient(app):
        pass

    assert events == [
        "database.start",
        "storage.start",
        "verifier.start",
        "jwks.close",
        "redis.close",
        "storage.close",
        "database.dispose",
    ]


def test_lifespan_closes_resources_when_startup_fails(
    create_test_app: Callable[..., FastAPI],
    mocker: MockerFixture,
) -> None:
    events: list[str] = []

    class Database:
        def start(self, *, tracer_provider: object | None = None) -> None:  # noqa: ARG002
            events.append("database.start")

        async def dispose(self) -> None:
            events.append("database.dispose")

    class Storage:
        def start(self) -> None:
            events.append("storage.start")
            raise RuntimeError("startup failed")  # noqa: TRY003, EM101

        def close(self) -> None:
            events.append("storage.close")

    class Redis:
        async def aclose(self) -> None:
            events.append("redis.close")

    class HTTPClient:
        async def aclose(self) -> None:
            events.append("jwks.close")

    mocker.patch("gateway.core.lifespan.httpx2.AsyncClient", return_value=HTTPClient())
    app = create_test_app()
    app.state.database = Database()
    app.state.storage = Storage()
    app.state.redis = Redis()

    with pytest.raises(RuntimeError, match="startup failed"), TestClient(app):
        pass

    assert events == [
        "database.start",
        "storage.start",
        "storage.close",
        "database.dispose",
    ]
