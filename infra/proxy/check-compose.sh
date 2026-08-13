#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
local_model="$(mktemp)"
production_model="$(mktemp)"

cleanup() {
  rm -f "$local_model" "$production_model"
}
trap cleanup EXIT

docker compose --project-directory "$repo_root" \
  -f "$repo_root/compose.yml" -f "$repo_root/compose.prod.yml" \
  config --format json >"$local_model"
docker compose --project-directory "$repo_root" \
  --env-file "$repo_root/.env.production.example" \
  -f "$repo_root/compose.yml" -f "$repo_root/compose.prod.yml" \
  config --format json >"$production_model"

python - "$local_model" "$production_model" <<'PY'
import json
import sys

with open(sys.argv[1]) as file:
    local = json.load(file)["services"]
with open(sys.argv[2]) as file:
    production = json.load(file)["services"]

assert local["web"]["environment"]["BETTER_AUTH_URL"] == "http://localhost:3000"
assert local["web"]["environment"]["GATEWAY_PUBLIC_URL"] == "http://localhost:8000"
assert local["gateway"]["environment"]["BETTER_AUTH_URL"] == "http://localhost:3000"
assert local["gateway"]["environment"]["GATEWAY_PUBLIC_URL"] == "http://localhost:8000"

assert production["web"]["environment"]["BETTER_AUTH_URL"] == "https://example.com"
assert production["web"]["environment"]["GATEWAY_PUBLIC_URL"] == "https://api.example.com"
assert production["web"]["environment"]["GATEWAY_INTERNAL_URL"] == "http://gateway:8000"
assert production["gateway"]["environment"]["BETTER_AUTH_URL"] == "https://example.com"
assert production["gateway"]["environment"]["WEB_INTERNAL_URL"] == "http://web:3000"
assert production["gateway"]["environment"]["GATEWAY_PUBLIC_URL"] == "https://api.example.com"

deployable_dockerfiles = {
    service["build"]["dockerfile"]
    for service in production.values()
    if isinstance(service.get("build"), dict) and service.get("build", {}).get("dockerfile")
}
assert deployable_dockerfiles == {
    "apps/web/Dockerfile",
    "apps/docs/Dockerfile",
    "apps/gateway/Dockerfile",
}
PY
