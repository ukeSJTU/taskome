package cli

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestExecuteHelp(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	exitCode := Execute(
		context.Background(),
		[]string{"--help"},
		strings.NewReader(""),
		&stdout,
		&stderr,
	)

	if exitCode != 0 {
		t.Fatalf("Execute(--help) exit code = %d, want 0", exitCode)
	}
	if !strings.Contains(stdout.String(), "Taskome command-line interface") {
		t.Fatalf("help output = %q, want Taskome description", stdout.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("help stderr = %q, want empty", stderr.String())
	}
}

func TestExecuteRejectsUnknownCommand(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	exitCode := Execute(context.Background(), []string{"unknown"}, strings.NewReader(""), &stdout, &stderr)

	if exitCode != 2 {
		t.Fatalf("Execute(unknown) exit code = %d, want 2", exitCode)
	}
	if !strings.Contains(stderr.String(), "unknown command") {
		t.Fatalf("stderr = %q, want unknown-command error", stderr.String())
	}
}

func TestExecuteVersion(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	exitCode := Execute(context.Background(), []string{"--version"}, strings.NewReader(""), &stdout, &stderr)

	if exitCode != 0 {
		t.Fatalf("Execute(--version) exit code = %d, want 0", exitCode)
	}
	if !strings.Contains(stdout.String(), "devel") {
		t.Fatalf("version output = %q, want devel", stdout.String())
	}
}

func TestExecuteGeneratesBashCompletion(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	exitCode := Execute(
		context.Background(),
		[]string{"completion", "bash"},
		strings.NewReader(""),
		&stdout,
		&stderr,
	)

	if exitCode != 0 {
		t.Fatalf("Execute(completion bash) exit code = %d, want 0", exitCode)
	}
	if !strings.Contains(stdout.String(), "# bash completion V2 for taskome") {
		t.Fatalf("completion output = %q, want bash completion script", stdout.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("completion stderr = %q, want empty", stderr.String())
	}
}
