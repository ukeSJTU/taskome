#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
install_error_trap
enter_repo_root

pass_count=0
warning_count=0
failure_count=0

pass() {
  pass_count=$((pass_count + 1))
  print_success "$1"
}

warn() {
  local message="$1"
  local remediation="${2:-}"

  warning_count=$((warning_count + 1))
  print_warning "$message"
  if [[ -n "$remediation" ]]; then
    printf '       Fix: %s\n' "$remediation" >&2
  fi
}

fail() {
  local message="$1"
  local remediation="${2:-}"

  failure_count=$((failure_count + 1))
  print_error "$message"
  if [[ -n "$remediation" ]]; then
    printf '        Fix: %s\n' "$remediation" >&2
  fi
}

check_command() {
  local label="$1"
  local command_name="$2"
  local remediation="$3"

  if command -v "$command_name" >/dev/null 2>&1; then
    pass "$label is available."
  else
    fail "$label is not available." "$remediation"
  fi
}

print_info "Checking the Taskome development environment."

check_command "mise" mise "Install mise, then run 'mise install --locked'."
check_command "Node.js" node "Run 'mise install --locked'."
check_command "pnpm" pnpm "Run 'mise install --locked'."
check_command "Go" go "Run 'mise install --locked'."
check_command "uv" uv "Run 'mise install --locked'."
check_command "Lefthook" lefthook "Run 'mise install --locked'."
check_command "Docker" docker "Install and start Docker Desktop or another compatible Docker engine."

if command -v go >/dev/null 2>&1; then
  if [[ "$(go env CGO_ENABLED)" == "1" ]]; then
    pass "CGO is enabled for race-enabled Go tests."
  else
    fail "CGO is disabled, so race-enabled Go tests cannot run." "Set 'CGO_ENABLED=1' in the development environment."
  fi

  read -r c_compiler _ <<<"$(go env CC)"
  if [[ -n "$c_compiler" ]] && command -v "$c_compiler" >/dev/null 2>&1; then
    pass "The Go C compiler is available: $c_compiler."
  else
    fail "The Go C compiler is not available." "Install a C compiler supported by the local Go toolchain."
  fi
fi

if command -v mise >/dev/null 2>&1; then
  if mise current >/dev/null 2>&1; then
    pass "Pinned mise tools are installed."
  else
    fail "One or more pinned mise tools are missing." "Run 'mise install --locked'."
  fi
fi

if [[ -f node_modules/.modules.yaml ]]; then
  pass "pnpm workspace dependencies are installed."
else
  fail "pnpm workspace dependencies are not installed." "Run 'pnpm install --frozen-lockfile'."
fi

if [[ -x .venv/bin/python ]]; then
  pass "The project Python environment is installed."
else
  fail "The project Python environment is not installed." "Run 'uv sync --frozen'."
fi

server_env="apps/server/.env"
if [[ -f "$server_env" ]]; then
  if pnpm --dir apps/server exec tsx -e 'import "@taskome/env/server";' >/dev/null 2>&1; then
    pass "Server environment variables are configured."

    if pnpm --dir apps/server exec tsx scripts/assert-local-database.ts compose >/dev/null 2>&1; then
      pass "Server DATABASE_URL targets the local Compose database."
    else
      warn "Server DATABASE_URL does not target the local Compose database." "Use the DATABASE_URL from 'apps/server/.env.example' before running 'mise run dev' or 'mise run //apps/server:db:reset'."
    fi
  else
    fail "Server environment variables are invalid." "Compare '$server_env' with 'apps/server/.env.example'."
  fi
else
  fail "Server environment file is missing." "Run 'mise run env:init'."
fi

console_env="apps/console/.env"
if [[ -f "$console_env" ]]; then
  if pnpm --dir apps/console exec tsx -e 'import "dotenv/config"; import { z } from "zod"; z.url().parse(process.env.VITE_SERVER_URL);' >/dev/null 2>&1; then
    pass "Console environment variables are configured."
  else
    fail "Console environment variables are invalid." "Compare '$console_env' with 'apps/console/.env.example'."
  fi
else
  fail "Console environment file is missing." "Run 'mise run env:init'."
fi

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    pass "The Docker engine is running."

    if docker compose version >/dev/null 2>&1; then
      pass "Docker Compose is available."

      if docker compose -f compose.yml ps --status running --services 2>/dev/null | grep -qx postgres; then
        pass "The local PostgreSQL service is running."
      else
        warn "The local PostgreSQL service is not running." "Run 'mise run dev:up' when you need the server."
      fi
    else
      fail "Docker Compose is not available." "Install a Docker distribution that includes Compose v2."
    fi
  else
    fail "The Docker engine is not reachable." "Start Docker, then rerun 'mise run doctor'."
  fi
fi

missing_hooks=()
for hook in pre-commit commit-msg pre-push; do
  hook_path="$(git rev-parse --git-path "hooks/$hook")"
  if [[ ! -x "$hook_path" ]]; then
    missing_hooks+=("$hook")
  fi
done

if [[ ${#missing_hooks[@]} -eq 0 ]]; then
  pass "Git hooks are installed."
else
  warn "Git hooks are missing: ${missing_hooks[*]}." "Run 'lefthook install'."
fi

printf '\nSummary: %d passed, %d warning(s), %d failure(s).\n' \
  "$pass_count" "$warning_count" "$failure_count"

if [[ "$failure_count" -gt 0 ]]; then
  exit 1
fi
