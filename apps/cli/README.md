# Taskome CLI

The Taskome command-line interface is a standalone Go module.

```bash
go run . --help
go run . version
go test ./...
go test -race ./...
```

Cobra provides completion scripts for Bash, Zsh, fish, and PowerShell:

```bash
go run . completion zsh
```

Release builds can inject version metadata with Go linker flags:

```bash
go build -o ../../build/taskome -ldflags "\
  -X github.com/ukeSJTU/taskome/apps/cli/cmd.version=1.2.3 \
  -X github.com/ukeSJTU/taskome/apps/cli/cmd.commit=abc1234 \
  -X github.com/ukeSJTU/taskome/apps/cli/cmd.date=2026-08-20T00:00:00Z"
```
