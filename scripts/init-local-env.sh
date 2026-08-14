#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
install_error_trap
enter_repo_root
require_command uv "Run 'mise run setup' to install the pinned toolchain."

web_env="apps/web/.env"
gateway_env="apps/gateway/.env"
temp_files=()

cleanup_temp_files() {
  local temp_file
  for temp_file in "${temp_files[@]}"; do
    rm -f -- "$temp_file" || true
  done
}
trap cleanup_temp_files EXIT

read_env_value() {
  local file="$1" key="$2"
  local -a values=()

  mapfile -t values < <(sed -n "s/^${key}=//p" "$file")
  case "${#values[@]}" in
  0) printf '' ;;
  1) printf '%s' "${values[0]}" ;;
  *) die "$file must define $key exactly once, using unquoted KEY=value syntax." ;;
  esac
}

is_placeholder() {
  [[ "$1" == replace-with-* || "$1" == "" ]]
}

generate_secret() {
  uv run python -c 'import secrets; print(secrets.token_urlsafe(48))'
}

write_web_env() {
  local temp_file

  [[ -r apps/web/.env.example ]] || die "Missing readable template: apps/web/.env.example"
  [[ ! -e "$web_env" ]] || die "$web_env appeared during initialization; refusing to overwrite it."
  temp_file="$(mktemp "${web_env}.tmp.XXXXXX")"
  temp_files+=("$temp_file")
  sed \
    -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$auth_secret|" \
    -e "s|^WEB_GATEWAY_HMAC_SECRET=.*|WEB_GATEWAY_HMAC_SECRET=$hmac_secret|" \
    apps/web/.env.example >"$temp_file"
  chmod 600 "$temp_file"
  mv -- "$temp_file" "$web_env"
}

write_gateway_env() {
  local temp_file

  [[ -r apps/gateway/.env.example ]] || die "Missing readable template: apps/gateway/.env.example"
  [[ ! -e "$gateway_env" ]] || die "$gateway_env appeared during initialization; refusing to overwrite it."
  temp_file="$(mktemp "${gateway_env}.tmp.XXXXXX")"
  temp_files+=("$temp_file")
  sed \
    -e "s|^WEB_GATEWAY_HMAC_SECRET=.*|WEB_GATEWAY_HMAC_SECRET=$hmac_secret|" \
    apps/gateway/.env.example >"$temp_file"
  chmod 600 "$temp_file"
  mv -- "$temp_file" "$gateway_env"
}

web_exists=false
gateway_exists=false
[[ -f "$web_env" ]] && web_exists=true
[[ -f "$gateway_env" ]] && gateway_exists=true

web_hmac=""
gateway_hmac=""
[[ "$web_exists" == true ]] && web_hmac="$(read_env_value "$web_env" WEB_GATEWAY_HMAC_SECRET)"
[[ "$gateway_exists" == true ]] && gateway_hmac="$(read_env_value "$gateway_env" WEB_GATEWAY_HMAC_SECRET)"

if [[ "$web_exists" == true ]] && is_placeholder "$web_hmac"; then
  echo "Existing $web_env must define a non-placeholder WEB_GATEWAY_HMAC_SECRET." >&2
  exit 1
fi
if [[ "$gateway_exists" == true ]] && is_placeholder "$gateway_hmac"; then
  echo "Existing $gateway_env must define a non-placeholder WEB_GATEWAY_HMAC_SECRET." >&2
  exit 1
fi
if [[ "$web_exists" == true && "$gateway_exists" == true && "$web_hmac" != "$gateway_hmac" ]]; then
  echo "Existing Web and Gateway WEB_GATEWAY_HMAC_SECRET values must be identical." >&2
  echo "Set the same high-entropy value in $web_env and $gateway_env, then rerun this command." >&2
  exit 1
fi

hmac_secret="$web_hmac"
if [[ -z "$hmac_secret" ]]; then
  hmac_secret="$gateway_hmac"
fi
if is_placeholder "$hmac_secret"; then
  hmac_secret="$(generate_secret)"
fi

if [[ "$web_exists" == false ]]; then
  auth_secret="$(generate_secret)"
  write_web_env
  printf 'Created %s with generated local secrets.\n' "$web_env"
else
  printf 'Kept existing %s unchanged.\n' "$web_env"
fi

if [[ "$gateway_exists" == false ]]; then
  write_gateway_env
  printf 'Created %s with the shared local HMAC secret.\n' "$gateway_env"
else
  printf 'Kept existing %s unchanged.\n' "$gateway_env"
fi

printf '\n%s\n' 'Local environment initialization is complete.'
printf '%s\n' 'Next steps:'
printf '%s\n' '  1. Review apps/web/.env and apps/gateway/.env for any local overrides.'
printf '%s\n' '  2. Run mise run dev:up to start and wait for PostgreSQL, Redis, SeaweedFS, and otel-gui.'
printf '%s\n' '  3. Run mise run gateway:db:migrate to apply Gateway Alembic revisions.'
printf '%s\n' '  4. Run mise run dev to start Web (:3000), Gateway (:8000), and Docs (:3001).'
printf '%s\n' 'The root .env is optional; create it from .env.example only to override Compose defaults.'
