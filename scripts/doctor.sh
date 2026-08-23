#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

trap 'error_status=$?; print_error "$SCRIPT_NAME could not complete its diagnosis on line $LINENO (exit $error_status)."; exit 2' ERR
enter_repo_root

verbose=false

usage() {
  printf 'Usage: mise run doctor [-- --verbose]\n' >&2
}

if [[ $# -gt 1 ]]; then
  usage
  exit 2
fi

if [[ $# -eq 1 ]]; then
  if [[ "$1" != "--verbose" ]]; then
    usage
    exit 2
  fi
  verbose=true
fi

result_groups=()
result_statuses=()
result_messages=()
result_actions=()
result_details=()
result_durations=()

record_result() {
  local group="$1"
  local status="$2"
  local message="$3"
  local action="${4:-}"
  local detail="${5:-}"
  local duration="${6:-0}"

  result_groups+=("$group")
  result_statuses+=("$status")
  result_messages+=("$message")
  result_actions+=("$action")
  result_details+=("$detail")
  result_durations+=("$duration")
}

count_results() {
  local expected_group="$1"
  local expected_status="$2"
  local count=0
  local index

  for ((index = 0; index < ${#result_groups[@]}; index++)); do
    if [[ "${result_groups[$index]}" == "$expected_group" && "${result_statuses[$index]}" == "$expected_status" ]]; then
      count=$((count + 1))
    fi
  done

  printf '%d' "$count"
}

format_duration() {
  local seconds="$1"

  if [[ "$seconds" -eq 0 ]]; then
    printf '<1s'
  else
    printf '%ss' "$seconds"
  fi
}

print_detail() {
  local detail="$1"
  local line

  while IFS= read -r line; do
    printf '    %s\n' "$line"
  done <<<"$detail"
}

render_result() {
  local index="$1"
  local status="${result_statuses[$index]}"
  local message="${result_messages[$index]}"
  local action="${result_actions[$index]}"
  local detail="${result_details[$index]}"
  local duration

  duration="$(format_duration "${result_durations[$index]}")"

  case "$status" in
    pass)
      print_success "$message ($duration)"
      ;;
    fail)
      print_failure "$message"
      if [[ -n "$action" ]]; then
        printf '    Fix: %s\n' "$action" >&2
      fi
      ;;
    readiness)
      print_readiness "$message"
      if [[ -n "$action" ]]; then
        printf '    Action: %s\n' "$action" >&2
      fi
      ;;
    error)
      print_error "$message"
      ;;
    *)
      print_error "Unknown doctor result status: $status"
      return 2
      ;;
  esac

  if [[ -n "$detail" && ( "$verbose" == true || "$status" == "readiness" ) ]]; then
    print_detail "$detail"
  fi
}

render_group() {
  local group="$1"
  local pass_count
  local fail_count
  local error_count
  local readiness_count
  local index

  pass_count="$(count_results "$group" pass)"
  fail_count="$(count_results "$group" fail)"
  error_count="$(count_results "$group" error)"
  readiness_count="$(count_results "$group" readiness)"

  printf '\n%s\n' "$group"

  if [[ "$verbose" == true ]]; then
    for ((index = 0; index < ${#result_groups[@]}; index++)); do
      if [[ "${result_groups[$index]}" == "$group" ]]; then
        render_result "$index"
      fi
    done
    return
  fi

  if [[ "$fail_count" -eq 0 && "$error_count" -eq 0 && "$readiness_count" -eq 0 ]]; then
    if [[ "$pass_count" -eq 1 ]]; then
      print_success "1 check passed."
    else
      print_success "$pass_count checks passed."
    fi
    return
  fi

  for ((index = 0; index < ${#result_groups[@]}; index++)); do
    if [[ "${result_groups[$index]}" == "$group" && "${result_statuses[$index]}" != "pass" ]]; then
      render_result "$index"
    fi
  done
}

check_mise_toolchain() {
  local started_at="$SECONDS"
  local output
  local status
  local detail=""

  if output="$(mise install --locked --dry-run-code --monorepo 2>&1)"; then
    if [[ "$verbose" == true ]]; then
      detail="$(mise ls --current --local --monorepo --no-header 2>/dev/null)"
    fi
    record_result "Toolchain" pass "Pinned mise tools are installed." "" "$detail" "$((SECONDS - started_at))"
    return
  else
    status=$?
  fi

  if [[ "$status" -eq 1 ]]; then
    record_result "Toolchain" fail "One or more pinned mise tools are missing." "mise install --locked" "$output" "$((SECONDS - started_at))"
  else
    record_result "Toolchain" error "Mise could not determine whether the pinned tools are installed (exit $status)." "" "$output" "$((SECONDS - started_at))"
  fi
}

docker_available=false

check_docker_cli() {
  local started_at="$SECONDS"
  local detail=""

  if command -v docker >/dev/null 2>&1; then
    docker_available=true
    if [[ "$verbose" == true ]]; then
      detail="$(docker --version 2>/dev/null || true)"
    fi
    record_result "Toolchain" pass "Docker CLI is available." "" "$detail" "$((SECONDS - started_at))"
  else
    record_result "Toolchain" fail "Docker CLI is not available." "Install Docker Desktop or another compatible Docker distribution." "" "$((SECONDS - started_at))"
  fi
}

check_docker_compose() {
  local started_at="$SECONDS"
  local detail=""

  if [[ "$docker_available" != true ]]; then
    return
  fi

  if detail="$(docker compose version 2>/dev/null)"; then
    record_result "Toolchain" pass "Docker Compose v2 is available." "" "$detail" "$((SECONDS - started_at))"
  else
    record_result "Toolchain" fail "Docker Compose v2 is not available." "Install a Docker distribution that includes Compose v2." "" "$((SECONDS - started_at))"
  fi
}

check_go_toolchain() {
  local started_at="$SECONDS"
  local cgo_enabled
  local c_compiler
  local c_compiler_config
  local compiler_detail=""

  if ! command -v go >/dev/null 2>&1; then
    record_result "Toolchain" fail "Go is not available in the mise environment." "mise install --locked" "" "$((SECONDS - started_at))"
    return
  fi

  if cgo_enabled="$(go env CGO_ENABLED 2>/dev/null)"; then
    if [[ "$cgo_enabled" == "1" ]]; then
      record_result "Toolchain" pass "CGO is enabled for race-enabled Go tests." "" "CGO_ENABLED=$cgo_enabled" "$((SECONDS - started_at))"
    else
      record_result "Toolchain" fail "CGO is disabled, so race-enabled Go tests cannot run." "Set CGO_ENABLED=1 in the development environment." "CGO_ENABLED=$cgo_enabled" "$((SECONDS - started_at))"
    fi
  else
    record_result "Toolchain" fail "Go could not report its CGO configuration." "Reinstall the pinned Go toolchain with 'mise install --locked'." "" "$((SECONDS - started_at))"
    return
  fi

  started_at="$SECONDS"
  if ! c_compiler_config="$(go env CC 2>/dev/null)"; then
    record_result "Toolchain" fail "Go could not report its C compiler." "Reinstall the pinned Go toolchain with 'mise install --locked'." "" "$((SECONDS - started_at))"
    return
  fi
  read -r c_compiler _ <<<"$c_compiler_config"

  if [[ -n "$c_compiler" ]] && command -v "$c_compiler" >/dev/null 2>&1; then
    if [[ "$verbose" == true ]]; then
      compiler_detail="$c_compiler_config"
    fi
    record_result "Toolchain" pass "The Go C compiler is available." "" "$compiler_detail" "$((SECONDS - started_at))"
  else
    record_result "Toolchain" fail "The Go C compiler is not available: ${c_compiler:-not configured}." "Install a C compiler supported by the pinned Go toolchain." "" "$((SECONDS - started_at))"
  fi
}

check_environment_file() {
  local path="$1"
  local label="$2"
  local started_at="$SECONDS"

  if [[ -f "$path" ]]; then
    record_result "Configuration" pass "$label environment file exists." "" "$path" "$((SECONDS - started_at))"
  else
    record_result "Configuration" fail "$label environment file is missing." "mise run env:init" "$path" "$((SECONDS - started_at))"
  fi
}

check_git_hooks() {
  local started_at="$SECONDS"
  local output
  local status
  local detail=""

  if ! command -v lefthook >/dev/null 2>&1; then
    record_result "Git integration" fail "Lefthook is not available, so Git hooks cannot be checked." "mise install --locked" "" "$((SECONDS - started_at))"
    return
  fi

  if output="$(lefthook check-install 2>&1)"; then
    if [[ "$verbose" == true ]]; then
      detail="$(lefthook version 2>/dev/null || true)"
    fi
    record_result "Git integration" pass "Lefthook Git hooks are installed and current." "" "$detail" "$((SECONDS - started_at))"
    return
  else
    status=$?
  fi

  if [[ "$status" -eq 1 ]]; then
    record_result "Git integration" fail "Lefthook Git hooks are missing or stale." "lefthook install" "$output" "$((SECONDS - started_at))"
  else
    record_result "Git integration" error "Lefthook could not determine whether Git hooks are installed (exit $status)." "" "$output" "$((SECONDS - started_at))"
  fi
}

check_docker_readiness() {
  local started_at="$SECONDS"
  local server_version

  if [[ "$docker_available" != true ]]; then
    record_result "Current readiness" readiness "Docker engine readiness is unavailable because Docker is not installed." "Install Docker Desktop or another compatible Docker distribution." "Needed for: dev, test:integration" "$((SECONDS - started_at))"
    return
  fi

  if server_version="$(docker info --format '{{.ServerVersion}}' 2>/dev/null)"; then
    record_result "Current readiness" pass "Docker engine is available." "" "Server version: $server_version" "$((SECONDS - started_at))"
  else
    record_result "Current readiness" readiness "Docker engine is not currently reachable." "Start Docker Desktop or another compatible engine and ensure the current user can access it." "Needed for: dev, test:integration" "$((SECONDS - started_at))"
  fi
}

render_optional_capabilities() {
  local submodule_status
  local total=0
  local initialized=0
  local line

  if [[ "$verbose" != true ]]; then
    return 0
  fi

  submodule_status="$(git submodule status --recursive 2>/dev/null || true)"
  if [[ -n "$submodule_status" ]]; then
    while IFS= read -r line; do
      total=$((total + 1))
      if [[ "${line:0:1}" != "-" ]]; then
        initialized=$((initialized + 1))
      fi
    done <<<"$submodule_status"
  fi

  printf '\nOptional capabilities\n'
  print_info "Reference submodules initialized: $initialized/$total."
}

check_mise_toolchain
check_docker_cli
check_docker_compose
check_go_toolchain
check_environment_file "apps/server/.env" "Server"
check_environment_file "apps/console/.env" "Console"
check_git_hooks
check_docker_readiness

printf 'Taskome development baseline\n'
render_group "Toolchain"
render_group "Configuration"
render_group "Git integration"
render_group "Current readiness"
render_optional_capabilities

failure_count=0
error_count=0
readiness_count=0
for ((index = 0; index < ${#result_statuses[@]}; index++)); do
  case "${result_statuses[$index]}" in
    fail)
      failure_count=$((failure_count + 1))
      ;;
    error)
      error_count=$((error_count + 1))
      ;;
    readiness)
      readiness_count=$((readiness_count + 1))
      ;;
  esac
done

printf '\n'
if [[ "$error_count" -gt 0 ]]; then
  print_error "Baseline: INDETERMINATE — $failure_count failure(s), $error_count doctor error(s), $readiness_count readiness notice(s)."
  exit 2
fi

if [[ "$failure_count" -gt 0 ]]; then
  print_failure "Baseline: BROKEN — $failure_count failure(s), $readiness_count readiness notice(s)."
  exit 1
fi

print_success "Baseline: HEALTHY — $readiness_count readiness notice(s)."
