#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
install_error_trap
enter_repo_root

pnpm --dir apps/server exec tsx scripts/assert-local-database.ts compose
docker compose -f compose.yml up --detach --wait --wait-timeout 60 postgres
docker compose -f compose.yml \
  exec -T postgres dropdb --if-exists --force --username taskome taskome
docker compose -f compose.yml \
  exec -T postgres createdb --username taskome --owner taskome taskome
mise run //apps/server:db:migrate

print_success "Recreated and migrated the local Taskome Compose database."
