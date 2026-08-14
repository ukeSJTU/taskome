#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
install_error_trap
enter_repo_root
require_command pnpm "Run 'mise run setup' to install the pinned dependencies."
require_command uv "Run 'mise run setup' to install the pinned dependencies."

fixture_path="$(mktemp)"
cleanup() {
  rm -f -- "$fixture_path" || true
}
trap cleanup EXIT

MCP_ONBOARDING_FIXTURE_PATH="$fixture_path" pnpm --dir apps/web exec vitest run \
  'src/app/api/auth/[...all]/route.test.ts' \
  --testNamePattern 'completes an OAuth authorization-code flow after user consent'
uv run --project apps/gateway python apps/gateway/tests/support/mcp_onboarding_probe.py \
  <"$fixture_path"
