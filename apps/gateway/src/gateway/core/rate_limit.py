from throttled.asyncio.store import RedisStore


def create_rate_limit_store(redis_url: str) -> RedisStore:
    return RedisStore(server=redis_url)
