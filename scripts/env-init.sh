#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
install_error_trap
enter_repo_root

ensure_env_file() {
  local example_file="$1"
  local env_file="$2"

  [[ -f "$example_file" ]] || die "Environment template not found: $example_file"

  if [[ -e "$env_file" || -L "$env_file" ]]; then
    print_info "Local environment file already exists: $env_file"
    return 0
  fi

  cp -n -- "$example_file" "$env_file"
  print_success "Created local environment file: $env_file"
}

ensure_env_file "apps/console/.env.example" "apps/console/.env"
ensure_env_file "apps/server/.env.example" "apps/server/.env"
