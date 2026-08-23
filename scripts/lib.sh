#!/usr/bin/env bash
# Shared defensive helpers for repository automation scripts.

_supports_color() {
  local output_fd="${1:-1}"

  [[ -z "${NO_COLOR+x}" && "${TERM:-}" != "dumb" && -t "$output_fd" ]]
}

_print_status() {
  local output_fd="$1"
  local color="$2"
  local label="$3"
  shift 3

  if _supports_color "$output_fd"; then
    printf '\033[%sm[%s]\033[0m %s\n' "$color" "$label" "$*" >&"$output_fd"
  else
    printf '[%s] %s\n' "$label" "$*" >&"$output_fd"
  fi
}

print_info() {
  _print_status 1 36 INFO "$@"
}

print_success() {
  _print_status 1 32 OK "$@"
}

print_warning() {
  _print_status 2 33 WARN "$@"
}

print_error() {
  _print_status 2 31 ERROR "$@"
}

print_failure() {
  _print_status 2 31 FAIL "$@"
}

print_readiness() {
  _print_status 2 33 READINESS "$@"
}

die() {
  print_error "$*"
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
  # shellcheck disable=SC2154 # error_status is assigned when the trap runs.
  trap 'error_status=$?; print_error "$SCRIPT_NAME failed on line $LINENO (exit $error_status)."; exit "$error_status"' ERR
}
