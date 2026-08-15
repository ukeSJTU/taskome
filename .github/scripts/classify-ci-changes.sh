#!/usr/bin/env bash
set -Eeuo pipefail

cli=false
contract=false
docs=false
e2e=false
fpocket=false
gateway=false
task_kit=false
typescript=false
web=false

run_all() {
  cli=true
  contract=true
  docs=true
  e2e=true
  fpocket=true
  gateway=true
  task_kit=true
  typescript=true
  web=true
}

if (( $# == 0 )); then
  run_all
fi

for path in "$@"; do
  case "$path" in
    docs/* | README.md | CONTEXT.md | AGENTS.md | LICENSE*)
      # Documentation-only changes still pass through the repository formatter.
      ;;
    apps/cli/*)
      cli=true
      case "$path" in
        apps/cli/go.mod | apps/cli/go.sum | apps/cli/mise.toml | apps/cli/oapi-codegen.yaml | apps/cli/internal/gateway/generated/*)
          contract=true
          ;;
      esac
      ;;
    apps/docs/*)
      docs=true
      typescript=true
      ;;
    apps/gateway/*)
      contract=true
      e2e=true
      gateway=true
      ;;
    apps/task-fpocket/*)
      fpocket=true
      ;;
    apps/web/*)
      e2e=true
      typescript=true
      web=true
      ;;
    packages/api-client/*)
      contract=true
      e2e=true
      typescript=true
      web=true
      ;;
    packages/auth/* | packages/db/* | packages/env/*)
      e2e=true
      typescript=true
      web=true
      ;;
    packages/config/*)
      docs=true
      e2e=true
      typescript=true
      web=true
      ;;
    packages/task-kit/*)
      fpocket=true
      task_kit=true
      ;;
    packages/ui/*)
      docs=true
      e2e=true
      typescript=true
      web=true
      ;;
    package.json | pnpm-lock.yaml | pnpm-workspace.yaml | .oxfmtrc.json)
      contract=true
      docs=true
      e2e=true
      typescript=true
      web=true
      ;;
    pyproject.toml | uv.lock)
      contract=true
      e2e=true
      fpocket=true
      gateway=true
      task_kit=true
      ;;
    .github/* | mise.toml | mise.lock | lefthook.yml | compose.yml | compose.*.yml | scripts/*)
      run_all
      ;;
    *)
      # Unknown paths run everything so a new component cannot silently bypass CI.
      run_all
      ;;
  esac
done

printf 'cli=%s\n' "$cli"
printf 'contract=%s\n' "$contract"
printf 'docs=%s\n' "$docs"
printf 'e2e=%s\n' "$e2e"
printf 'fpocket=%s\n' "$fpocket"
printf 'gateway=%s\n' "$gateway"
printf 'task_kit=%s\n' "$task_kit"
printf 'typescript=%s\n' "$typescript"
printf 'web=%s\n' "$web"
