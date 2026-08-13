import os

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")


class FakeRedis:
    async def ping(self) -> bool:
        return True

    async def aclose(self) -> None:
        pass


@pytest.fixture(autouse=True)
def fake_rate_limit_redis(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("gateway.main.Redis.from_url", lambda _url: FakeRedis())
