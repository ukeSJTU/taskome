#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
install_error_trap

: "${usage_type:?Run via 'mise run worktree:remove <type> <slug>'.}"
: "${usage_slug:?Run via 'mise run worktree:remove <type> <slug>'.}"
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
git remote get-url origin >/dev/null 2>&1 || die "Git remote 'origin' is required to confirm worktree integration."
branch="$usage_type/$usage_slug"
worktree=".worktrees/$usage_slug"

if [[ ! -d "$worktree" ]]; then
  printf 'ERROR: Worktree does not exist: %s\n' "$worktree" >&2
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/$branch"; then
  printf 'ERROR: Local branch does not exist: %s\n' "$branch" >&2
  exit 1
fi

if [[ -n "$(git -C "$worktree" status --porcelain)" ]]; then
  printf 'ERROR: Worktree has uncommitted changes: %s\n' "$worktree" >&2
  exit 1
fi

worktree_branch="$(git -C "$worktree" branch --show-current)"
if [[ "$worktree_branch" != "$branch" ]]; then
  die "Worktree branch mismatch: expected $branch, found ${worktree_branch:-detached HEAD}."
fi

if ! submodule_status="$(git -C "$worktree" submodule status --recursive)"; then
  printf 'ERROR: Could not inspect worktree submodules: %s\n' "$worktree" >&2
  exit 1
fi

if grep -qv '^-' <<<"$submodule_status"; then
  printf 'ERROR: Worktree has initialized submodules; handle them separately before cleanup: %s\n' "$worktree" >&2
  exit 1
fi

git fetch origin main

integrated=false
if git merge-base --is-ancestor "$branch" origin/main; then
  integrated=true
elif command -v gh >/dev/null 2>&1; then
  local_head="$(git rev-parse "$branch")"
  if merged_pr_head="$(gh pr list --state merged --head "$branch" --base main --limit 1 --json headRefOid --jq '.[0].headRefOid // ""')" &&
    [[ -n "$merged_pr_head" && "$merged_pr_head" == "$local_head" ]]; then
    integrated=true
  fi
fi

if [[ "$integrated" != true ]]; then
  printf 'ERROR: Branch is not integrated into origin/main and no merged PR could be confirmed: %s\n' "$branch" >&2
  exit 1
fi

git worktree remove "$worktree"
git branch -D "$branch"
