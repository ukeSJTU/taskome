# syntax=docker/dockerfile:1.7
FROM --platform=linux/amd64 node:24.18.1-alpine AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/console/package.json ./apps/console/
COPY apps/docs/package.json ./apps/docs/
COPY apps/execution/package.json ./apps/execution/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/env/package.json ./packages/env/
COPY packages/ui/package.json ./packages/ui/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM dependencies AS build

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL

RUN test -n "$VITE_SERVER_URL" || (echo "VITE_SERVER_URL build argument is required" >&2; exit 1)

COPY apps/console ./apps/console
COPY packages/config ./packages/config
COPY packages/env ./packages/env
COPY packages/ui ./packages/ui

RUN pnpm --filter console build

FROM --platform=linux/amd64 caddy:2.10.2-alpine AS runtime

RUN addgroup --system caddy && adduser --system --ingroup caddy caddy && chown -R caddy:caddy /config /data

COPY apps/console/Caddyfile /etc/caddy/Caddyfile
COPY --from=build --chown=caddy:caddy /app/apps/console/dist /srv

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

USER caddy
