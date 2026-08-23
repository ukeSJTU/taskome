#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
install_error_trap
enter_repo_root

repo_root="$(pwd -P)"
server_dir="$repo_root/apps/server"
check_dir="$(mktemp -d "$server_dir/.drizzle-check.XXXXXX")"

cleanup() {
  [[ "$check_dir" == "$server_dir/.drizzle-check."* ]] || return 1
  rm -rf -- "$check_dir"
}

trap cleanup EXIT
mkdir -p -- "$check_dir/drizzle"
cp -R -- "$server_dir/drizzle/." "$check_dir/drizzle/"

DATABASE_URL="postgresql://taskome:taskome@localhost:5432/taskome" \
BETTER_AUTH_SECRET="development-only-secret-change-me" \
BETTER_AUTH_URL="http://localhost:3000" \
CORS_ORIGIN="http://localhost:3001" \
NODE_ENV="test" \
  pnpm --dir "$server_dir" exec auth generate --output "$check_dir/auth.ts" --yes
pnpm exec oxfmt --stdin-filepath="$server_dir/src/db/schema/auth.ts" \
  <"$check_dir/auth.ts" \
  >"$check_dir/auth.formatted.ts"
mv -- "$check_dir/auth.formatted.ts" "$check_dir/auth.ts"

if ! diff -q -- "$server_dir/src/db/schema/auth.ts" "$check_dir/auth.ts" >/dev/null; then
  diff -u -- "$server_dir/src/db/schema/auth.ts" "$check_dir/auth.ts" || true
  die "Better Auth schema has drifted. Run 'mise run //apps/server:auth:generate' and review the diff."
fi

DATABASE_URL="postgresql://taskome:taskome@localhost:5432/taskome" \
  pnpm --dir "$server_dir" run db:check

check_name="$(basename -- "$check_dir")"
pnpm --dir "$server_dir" exec drizzle-kit generate \
  --schema ./src/db/schema/index.ts \
  --out "./$check_name/drizzle" \
  --dialect postgresql \
  --name schema-check

if ! diff -qr -- "$server_dir/drizzle" "$check_dir/drizzle"; then
  die "Database schema and committed migrations have drifted. Run 'mise run //apps/server:db:generate <name>' and review the SQL."
fi

print_success "Better Auth schema, migration history, and database schema artifacts are consistent."
