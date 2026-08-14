#!/usr/bin/env bash
# Shared defensive helpers for repository automation scripts.

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  local remediation="$2"

  command -v "$command_name" >/dev/null 2>&1 || die "Required command not found: $command_name. $remediation"
}

enter_repo_root() {
  local repo_root

  require_command git "Install Git, then rerun this command."
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || die "Run this command from inside the Taskome repository."
  cd -- "$repo_root" || die "Could not enter repository root: $repo_root"
}

install_error_trap() {
  trap 'printf "ERROR: %s failed on line %s (exit %s).\\n" "$SCRIPT_NAME" "$LINENO" "$?" >&2' ERR
}
