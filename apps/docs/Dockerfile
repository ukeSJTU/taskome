# syntax=docker/dockerfile:1
FROM node:24-slim AS deps
RUN npm install -g pnpm@11
WORKDIR /app

COPY --parents package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json ./
RUN --mount=type=cache,target=/pnpm-store pnpm install --frozen-lockfile --store-dir /pnpm-store

FROM deps AS builder
COPY . .

ENV NODE_ENV=production
RUN cd apps/docs && pnpm run build
RUN mkdir -p apps/docs/public

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/apps/docs/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=builder --chown=node:node /app/apps/docs/public ./apps/docs/public

ENV HOSTNAME=0.0.0.0
ENV PORT=3001
EXPOSE 3001
USER node

CMD ["node", "apps/docs/server.js"]
