# syntax=docker/dockerfile:1.18

ARG PYTHON_IMAGE=python:3.14.7-slim-bookworm@sha256:23c59390fc717bf09f9336908199a0ae75d9c4264bf296123f94ad772fea3b52

FROM ${PYTHON_IMAGE} AS adapter-builder

ADD --checksum=sha256:47823f814693bab8623308341369190de30b5c621eec5b1ee20352eae8c7982c \
    https://github.com/astral-sh/uv/releases/download/0.12.1/uv-x86_64-unknown-linux-musl.tar.gz \
    /tmp/uv.tar.gz

RUN mkdir /tmp/uv \
    && tar -xzf /tmp/uv.tar.gz -C /tmp/uv --strip-components=1 \
    && install -m 0755 /tmp/uv/uv /usr/local/bin/uv

WORKDIR /build

COPY pyproject.toml uv.lock ./
COPY packages/toolkit/pyproject.toml packages/toolkit/pyproject.toml
COPY packages/toolkit/src packages/toolkit/src
COPY runtimes/fpocket/pyproject.toml runtimes/fpocket/pyproject.toml
COPY runtimes/fpocket/src runtimes/fpocket/src

ENV UV_PROJECT_ENVIRONMENT=/opt/taskome/adapter

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable --package fpocket-runtime

FROM ${PYTHON_IMAGE} AS compute-builder

ADD --checksum=sha256:0697808e0104141dcdecc1ec5cf07c175141bddb0a05c3fdffc8600282a66cda \
    https://github.com/pavelzw/pixi-install-to-prefix/releases/download/v0.1.6/pixi-install-to-prefix-x86_64-unknown-linux-musl \
    /tmp/pixi-install-to-prefix

RUN install -m 0755 /tmp/pixi-install-to-prefix /usr/local/bin/pixi-install-to-prefix

WORKDIR /build/compute

COPY runtimes/fpocket/compute/pixi.lock ./

RUN --mount=type=cache,target=/root/.cache/rattler \
    pixi-install-to-prefix \
    --lockfile pixi.lock \
    --environment default \
    --platform linux-64 \
    --no-activation-scripts \
    /opt/taskome/compute

FROM ${PYTHON_IMAGE} AS runtime

LABEL org.opencontainers.image.title="Taskome fpocket Runtime" \
    org.opencontainers.image.description="Locked fpocket compute and Taskome adapter environments"

ENV HOME=/work \
    PATH=/opt/taskome/adapter/bin:/opt/taskome/compute/bin:/usr/local/bin:/usr/bin:/bin \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN install -d -o 10001 -g 10001 -m 0750 /work

COPY --from=adapter-builder /opt/taskome/adapter /opt/taskome/adapter
COPY --from=compute-builder /opt/taskome/compute /opt/taskome/compute

RUN /usr/local/bin/python -m pip uninstall --yes pip \
    && chmod -R a-w /opt/taskome

USER 10001:10001
WORKDIR /work

# The final Attempt entrypoint remains intentionally undefined until its
# Invocation interface is designed. Fail closed instead of shipping a temporary
# command contract.
CMD ["/bin/false"]
