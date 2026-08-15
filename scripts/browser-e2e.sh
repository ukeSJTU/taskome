#!/usr/bin/env bash
set -Eeuo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
run_id="${E2E_RUN_ID:-$(date +%s)-$RANDOM}"
project="taskome-e2e-${run_id//[^a-zA-Z0-9]/}"
logs_dir="${E2E_LOG_DIR:-$root/apps/web/test-results/services-$run_id}"
mkdir -p "$logs_dir"

pick_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'; }
postgres_port="$(pick_port)"; redis_port="$(pick_port)"; seaweed_port="$(pick_port)"; web_port="$(pick_port)"; gateway_port="$(pick_port)"
export E2E_POSTGRES_PORT="$postgres_port" E2E_REDIS_PORT="$redis_port" E2E_SEAWEED_PORT="$seaweed_port"
export E2E_WEB_URL="http://localhost:$web_port" E2E_GATEWAY_URL="http://127.0.0.1:$gateway_port"
export E2E_DISABLE_AUTH_RATE_LIMIT=true
export DATABASE_URL="postgresql://postgres:e2e-password@127.0.0.1:$postgres_port/taskome"
web_database_url="$DATABASE_URL"
export E2E_WEB_DATABASE_URL="$web_database_url"
export BETTER_AUTH_URL="$E2E_WEB_URL" AUTH_TRUSTED_ORIGIN="$E2E_WEB_URL" WEB_PUBLIC_URL="$E2E_WEB_URL" GATEWAY_PUBLIC_URL="$E2E_GATEWAY_URL" GATEWAY_INTERNAL_URL="$E2E_GATEWAY_URL"
export WEB_INTERNAL_URL="$E2E_WEB_URL" REDIS_URL="redis://127.0.0.1:$redis_port/0" SEAWEEDFS_INTERNAL_ENDPOINT="http://127.0.0.1:$seaweed_port" SEAWEEDFS_PUBLIC_ENDPOINT="http://127.0.0.1:$seaweed_port"
export BETTER_AUTH_SECRET="e2e-better-auth-secret-${run_id}-minimum-32-characters" WEB_GATEWAY_HMAC_SECRET="e2e-web-gateway-secret-${run_id}-minimum-32-characters" SEAWEEDFS_SECRET_KEY="e2e-seaweedfs-secret-key-${run_id}-minimum-32-characters"
cleanup() { status=$?; if [[ $status -ne 0 ]]; then mkdir -p "$logs_dir"; docker compose -p "$project" -f infra/e2e/compose.yml logs >"$logs_dir/compose.log" 2>&1 || true; fi; docker compose -p "$project" -f infra/e2e/compose.yml down --volumes --remove-orphans || true; exit "$status"; }
trap cleanup EXIT INT TERM
docker compose -p "$project" -f infra/e2e/compose.yml up -d --wait
pnpm --filter @taskome/db db:migrate
export DATABASE_URL="postgresql+psycopg://postgres:e2e-password@127.0.0.1:$postgres_port/taskome"
(cd apps/gateway && PYTHONPATH=. uv run python -m scripts.database migrate)
pnpm --dir apps/web exec playwright test "$@"
