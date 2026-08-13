from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

import pytest
from gateway.core.config import Environment, Settings
from gateway.main import create_app

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI
    from gateway.db.database import Database
    from redis.asyncio import Redis


class FakeDatabase:
    """Stands in for `Database` in tests that never touch Postgres."""

    async def dispose(self) -> None:
        pass

    async def is_at_head(self) -> bool:
        return True

    async def is_available(self) -> bool:
        return True


class FakeRateLimitRedis:
    """Stands in for the Redis client `lifespan` pings on every startup, in every environment."""

    async def ping(self) -> bool:
        return True

    async def aclose(self) -> None:
        pass


@pytest.fixture
def create_test_app() -> Callable[..., FastAPI]:
    """Build a Gateway app wired to fakes, so `TestClient(app)` never needs real infra.

    Pass keyword overrides to swap in a real or different fake for a specific test,
    e.g. `create_test_app(rest_token_verifier=my_verifier)`.
    """

    def _create(settings: Settings | None = None, **overrides: Any) -> FastAPI:  # noqa: ANN401
        overrides.setdefault("database", cast("Database", FakeDatabase()))
        overrides.setdefault("rate_limit_redis", cast("Redis", FakeRateLimitRedis()))
        return create_app(settings or Settings(app_environment=Environment.TEST), **overrides)

    return _create
