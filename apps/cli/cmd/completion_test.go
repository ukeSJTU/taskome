package cmd

import (
	"bytes"
	"strings"
	"testing"
)

func TestCompletionCommand(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		shell      string
		wantHeader string
	}{
		{name: "bash", shell: "bash", wantHeader: "bash completion V2 for taskome"},
		{name: "zsh", shell: "zsh", wantHeader: "#compdef taskome"},
		{name: "fish", shell: "fish", wantHeader: "__taskome_debug"},
		{name: "PowerShell", shell: "powershell", wantHeader: "powershell completion for taskome"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			root := newRootCommand(buildInfo{version: "test-version"})
			var stdout bytes.Buffer
			var stderr bytes.Buffer
			root.SetOut(&stdout)
			root.SetErr(&stderr)
			root.SetArgs([]string{"completion", tt.shell})

			if err := root.ExecuteContext(t.Context()); err != nil {
				t.Fatalf("ExecuteContext() error = %v", err)
			}
			if !strings.Contains(stdout.String(), tt.wantHeader) {
				t.Errorf("completion output does not contain %q", tt.wantHeader)
			}
			if stderr.Len() != 0 {
				t.Errorf("completion stderr = %q, want empty", stderr.String())
			}
		})
	}
}

func TestCompletionCommandRejectsInvalidShell(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := execute(
		t.Context(),
		[]string{"completion", "invalid"},
		&stdout,
		&stderr,
		buildInfo{version: "test-version"},
	)

	if code != exitUsage {
		t.Errorf("execute() code = %d, want %d", code, exitUsage)
	}
	if stdout.Len() != 0 {
		t.Errorf("execute() stdout = %q, want empty", stdout.String())
	}
	if !strings.Contains(stderr.String(), "invalid argument") {
		t.Errorf("execute() stderr = %q, want invalid argument error", stderr.String())
	}
}
