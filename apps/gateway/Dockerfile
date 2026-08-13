# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:python3.14-trixie-slim AS deps
WORKDIR /app
# the cache mount and /app live on different filesystems, so hardlinking never applies
ENV UV_LINK_MODE=copy

# Manifests only, so this layer (and the sync below) survives source-only changes
COPY pyproject.toml uv.lock ./
COPY apps/gateway/pyproject.toml apps/gateway/pyproject.toml
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-workspace

FROM deps AS builder
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

FROM python:3.14-slim AS runner
RUN groupadd --gid 1001 gateway \
    && useradd --uid 1001 --gid gateway --no-create-home --shell /usr/sbin/nologin gateway
WORKDIR /app/apps/gateway
ENV PATH="/app/.venv/bin:$PATH"
ENV APP_ENVIRONMENT=production

COPY --from=builder --chown=gateway:gateway /app/.venv /app/.venv
COPY --from=builder --chown=gateway:gateway /app/apps/gateway /app/apps/gateway

EXPOSE 8000
USER gateway

CMD ["uvicorn", "gateway.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-config", "logging.prod.json"]
