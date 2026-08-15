# syntax=docker/dockerfile:1

FROM debian:bookworm-slim AS fpocket-build
WORKDIR /build

RUN apt-get update \
    && apt-get install --yes --no-install-recommends gcc g++ make libnetcdf-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only the files needed by `make fpocket`; fpocket's docs, sample corpus,
# tests, and dynamic molfile plugins are intentionally outside the build context.
COPY apps/task-fpocket/compute/makefile ./
COPY apps/task-fpocket/compute/src ./src
COPY apps/task-fpocket/compute/headers ./headers
COPY apps/task-fpocket/compute/plugins/include ./plugins/include
COPY apps/task-fpocket/compute/plugins/LINUXAMD64/molfile/libmolfile_plugin.a \
    ./plugins/LINUXAMD64/molfile/libmolfile_plugin.a
COPY apps/task-fpocket/compute/plugins/LINUXAMD64/molfile/libmolfile_plugin.h \
    ./plugins/LINUXAMD64/molfile/libmolfile_plugin.h

RUN mkdir --parents bin obj \
    && make fpocket

FROM ghcr.io/astral-sh/uv:python3.14-trixie-slim AS python-deps
WORKDIR /app/apps/task-fpocket
ENV UV_LINK_MODE=copy

# Keep dependency resolution cached when application source changes.
COPY apps/task-fpocket/pyproject.toml apps/task-fpocket/uv.lock ./
COPY packages/task-kit /app/packages/task-kit
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

FROM python-deps AS python-build
COPY apps/task-fpocket/src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

FROM python:3.14-slim AS runner
RUN groupadd --gid 1001 fpocket \
    && useradd --uid 1001 --gid fpocket --no-create-home --shell /usr/sbin/nologin fpocket

WORKDIR /app/apps/task-fpocket
ENV PATH="/app/.venv/bin:$PATH" \
    FPOCKET_BINARY=/usr/local/bin/fpocket

COPY --from=fpocket-build --chown=fpocket:fpocket /build/bin/fpocket /usr/local/bin/fpocket
COPY --from=python-build --chown=fpocket:fpocket /app/apps/task-fpocket/.venv /app/.venv
COPY --from=python-build --chown=fpocket:fpocket /app/apps/task-fpocket /app/apps/task-fpocket
# The editable task-kit install resolves via a .pth pointing at this source
# tree (see /app/.venv/.../task_kit.pth), not a copied/compiled package --
# without it the app fails at import time with ModuleNotFoundError.
COPY --from=python-build --chown=fpocket:fpocket /app/packages/task-kit /app/packages/task-kit

USER fpocket
CMD ["fpocket-server"]
