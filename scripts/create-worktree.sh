#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
install_error_trap

: "${usage_type:?Run via 'mise run worktree:create <type> <slug>'.}"
: "${usage_slug:?Run via 'mise run worktree:create <type> <slug>'.}"
require_command git "Install Git, then rerun this command."

case "$usage_type" in
feat | fix | chore) ;;
*)
  printf 'ERROR: Invalid type: %s. Use feat, fix, or chore.\n' "$usage_type" >&2
  exit 1
  ;;
esac

if [[ ! "$usage_slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  printf 'ERROR: Invalid slug: %s. Use lowercase kebab-case.\n' "$usage_slug" >&2
  exit 1
fi

common_git_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
repo_root="${common_git_dir%/.git}"
cd "$repo_root" || die "Could not enter repository root: $repo_root"
git remote get-url origin >/dev/null 2>&1 || die "Git remote 'origin' is required to create a worktree from origin/main."
branch="$usage_type/$usage_slug"
worktree=".worktrees/$usage_slug"

if git show-ref --verify --quiet "refs/heads/$branch"; then
  printf 'ERROR: Branch already exists: %s\n' "$branch" >&2
  exit 1
fi

if [[ -e "$worktree" ]]; then
  printf 'ERROR: Worktree path already exists: %s\n' "$worktree" >&2
  exit 1
fi

git fetch origin main
git worktree add -b "$branch" "$worktree" origin/main
