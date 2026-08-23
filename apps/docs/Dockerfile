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

COPY apps/docs ./apps/docs
COPY packages/config ./packages/config

RUN pnpm --filter docs build

FROM --platform=linux/amd64 node:24.18.1-alpine AS runtime

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

COPY --from=build --chown=node:node /app/apps/docs/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/docs/.next/static ./apps/docs/.next/static

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

USER node

CMD ["node", "apps/docs/server.js"]
