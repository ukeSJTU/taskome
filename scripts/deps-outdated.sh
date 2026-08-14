#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
install_error_trap
enter_repo_root
require_command pnpm "Run 'mise run setup' to install the pinned toolchain."
require_command uv "Run 'mise run setup' to install the pinned toolchain."
require_command mise "Install Mise, then rerun this command."

# `pnpm outdated` intentionally exits 1 when it finds updates. Keep going so
# one report covers every ecosystem. Finding updates is still overall success;
# only a command failure returns a non-zero status.
printf '%s\n' '== Node packages and GitHub Actions =='
if pnpm outdated -r --include-github-actions; then
  status=0
else
  status=$?
fi
if [[ $status -ne 0 && $status -ne 1 ]]; then
  exit "$status"
fi

printf '\n%s\n' '== Python packages =='
uv lock --upgrade --dry-run

printf '\n%s\n' '== Mise tools =='
mise outdated
