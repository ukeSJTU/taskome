import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")
os.environ.setdefault(
    "WEB_GATEWAY_HMAC_SECRET",
    "gateway-test-secret-not-for-production-123456",
)
