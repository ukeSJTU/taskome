#!/bin/sh

# Git clients launched outside an interactive shell may not inherit mise's PATH.
# Lefthook sources this file before running a hook, so load the environment from
# the repository's mise.toml explicitly.

if [ -z "${HOME:-}" ]; then
  printf '%s\n' "Taskome Git hooks require HOME to locate mise." >&2
  exit 1
fi

# Prefer mise from the inherited PATH, then try its standard installation paths.
taskome_mise_bin="$(command -v mise 2>/dev/null || true)"

if [ -z "$taskome_mise_bin" ]; then
  for taskome_mise_candidate in \
    "$HOME/.local/bin/mise" \
    "/opt/homebrew/bin/mise" \
    "/usr/local/bin/mise" \
    "/home/linuxbrew/.linuxbrew/bin/mise"
  do
    if [ -x "$taskome_mise_candidate" ]; then
      taskome_mise_bin="$taskome_mise_candidate"
      break
    fi
  done
fi

if [ -z "$taskome_mise_bin" ]; then
  printf '%s\n' \
    "Taskome Git hooks require mise. Install it, then run 'mise run setup'." >&2
  exit 1
fi

# Keep mise itself available for hook jobs such as `mise run verify`.
taskome_mise_dir="${taskome_mise_bin%/*}"
if [ "$taskome_mise_dir" != "$taskome_mise_bin" ]; then
  export PATH="$taskome_mise_dir:$PATH"
fi

# `mise env` emits simple export statements; bash output is compatible with the
# POSIX shell used by Git hooks.
if ! taskome_mise_env="$("$taskome_mise_bin" env --shell bash)"; then
  printf '%s\n' "Failed to load the Taskome mise environment." >&2
  exit 1
fi

if ! eval "$taskome_mise_env"; then
  printf '%s\n' "Failed to apply the Taskome mise environment." >&2
  exit 1
fi

unset taskome_mise_bin taskome_mise_candidate taskome_mise_dir taskome_mise_env
