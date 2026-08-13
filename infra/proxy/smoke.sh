#!/usr/bin/env bash
set -euo pipefail

proxy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
compose_file="$proxy_dir/compose.smoke.yml"
CADDY_SMOKE_PORT="$(python -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
export CADDY_SMOKE_PORT

cleanup() {
  docker compose -f "$compose_file" down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose -f "$compose_file" config --quiet
docker compose -f "$compose_file" up --detach --wait --wait-timeout 30

request() {
  local host="$1"
  local path="$2"
  curl --fail-with-body --silent --show-error --max-time 5 \
    --header "Host: $host" \
    "http://127.0.0.1:${CADDY_SMOKE_PORT}${path}"
}

assert_route() {
  local host="$1"
  local path="$2"
  local expected="$3"
  local actual
  actual="$(request "$host" "$path")"
  [[ "$actual" == "$expected" ]] || {
    echo "Expected $host$path to reach $expected, got $actual" >&2
    return 1
  }
}

assert_unavailable() {
  local path="$1"
  local status
  status="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 \
    --header 'Host: api.example.test' \
    "http://127.0.0.1:${CADDY_SMOKE_PORT}${path}")"
  [[ "$status" == "404" ]] || {
    echo "Expected api.example.test$path to be unavailable, got HTTP $status" >&2
    return 1
  }
}

assert_no_cors() {
  local headers
  headers="$(curl --silent --dump-header - --output /dev/null --max-time 5 \
    --header 'Host: api.example.test' \
    "http://127.0.0.1:${CADDY_SMOKE_PORT}/v1")"
  if grep --ignore-case --quiet '^access-control-allow-origin:' <<<"$headers"; then
    echo "The public API edge must not add Access-Control-Allow-Origin" >&2
    return 1
  fi
}

assert_route example.test / web
assert_route example.test /mcp web
assert_route docs.example.test /guide docs
assert_route api.example.test /v1 gateway
assert_route api.example.test /v1/me gateway
assert_route api.example.test /mcp gateway
assert_route api.example.test /mcp/ gateway
assert_route api.example.test /.well-known/oauth-protected-resource/mcp gateway

for path in / /scalar /openapi.json /health/live /api/auth /internal/openapi.json; do
  assert_unavailable "$path"
done

assert_no_cors
