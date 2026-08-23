package cmd

import (
	"bytes"
	"errors"
	"strings"
	"testing"
)

var errWrite = errors.New("write failed")

type errorWriter struct{}

func (errorWriter) Write([]byte) (int, error) {
	return 0, errWrite
}

func TestExecute(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		args       []string
		wantCode   int
		wantStdout string
		wantStderr string
	}{
		{
			name:       "root help",
			wantCode:   exitSuccess,
			wantStdout: "Taskome command-line interface",
		},
		{
			name:       "version flag",
			args:       []string{"--version"},
			wantCode:   exitSuccess,
			wantStdout: "taskome test-version\n",
		},
		{
			name:       "unexpected argument",
			args:       []string{"unexpected"},
			wantCode:   exitUsage,
			wantStderr: "Error:",
		},
		{
			name:       "unknown flag",
			args:       []string{"--unknown"},
			wantCode:   exitUsage,
			wantStderr: "Error:",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var stdout bytes.Buffer
			var stderr bytes.Buffer
			code := execute(
				t.Context(),
				tt.args,
				&stdout,
				&stderr,
				buildInfo{version: "test-version", commit: "test-commit", date: "test-date"},
			)

			if code != tt.wantCode {
				t.Errorf("execute() code = %d, want %d", code, tt.wantCode)
			}
			if tt.wantStdout == "" && stdout.Len() != 0 {
				t.Errorf("execute() stdout = %q, want empty", stdout.String())
			} else if !strings.Contains(stdout.String(), tt.wantStdout) {
				t.Errorf("execute() stdout = %q, want substring %q", stdout.String(), tt.wantStdout)
			}
			if tt.wantStderr == "" && stderr.Len() != 0 {
				t.Errorf("execute() stderr = %q, want empty", stderr.String())
			} else if !strings.Contains(stderr.String(), tt.wantStderr) {
				t.Errorf("execute() stderr = %q, want substring %q", stderr.String(), tt.wantStderr)
			}
		})
	}
}

func TestExecuteOutputError(t *testing.T) {
	t.Parallel()

	var stderr bytes.Buffer
	code := execute(
		t.Context(),
		[]string{"version"},
		errorWriter{},
		&stderr,
		buildInfo{version: "test-version"},
	)

	if code != exitFailure {
		t.Errorf("execute() code = %d, want %d", code, exitFailure)
	}
	if !strings.Contains(stderr.String(), errWrite.Error()) {
		t.Errorf("execute() stderr = %q, want substring %q", stderr.String(), errWrite)
	}
}

func TestNewRootCommand(t *testing.T) {
	t.Parallel()

	first := newRootCommand(buildInfo{version: "first"})
	second := newRootCommand(buildInfo{version: "second"})

	if first == second {
		t.Fatal("newRootCommand() reused a command instance")
	}
	if !first.SilenceUsage {
		t.Error("newRootCommand() SilenceUsage = false, want true")
	}
	if !first.SilenceErrors {
		t.Error("newRootCommand() SilenceErrors = false, want true")
	}
	if first.Version != "first" {
		t.Errorf("newRootCommand() Version = %q, want %q", first.Version, "first")
	}
	if second.Version != "second" {
		t.Errorf("newRootCommand() Version = %q, want %q", second.Version, "second")
	}
}
