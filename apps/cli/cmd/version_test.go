package cmd

import (
	"bytes"
	"fmt"
	"runtime"
	"testing"
)

func TestVersionCommand(t *testing.T) {
	t.Parallel()

	info := buildInfo{
		version: "1.2.3",
		commit:  "abc1234",
		date:    "2026-08-20T00:00:00Z",
	}
	root := newRootCommand(info)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	root.SetOut(&stdout)
	root.SetErr(&stderr)
	root.SetArgs([]string{"version"})

	if err := root.ExecuteContext(t.Context()); err != nil {
		t.Fatalf("ExecuteContext() error = %v", err)
	}

	want := fmt.Sprintf(
		"taskome 1.2.3\ncommit: abc1234\nbuilt: 2026-08-20T00:00:00Z\ngo: %s\n",
		runtime.Version(),
	)
	if stdout.String() != want {
		t.Errorf("version output = %q, want %q", stdout.String(), want)
	}
	if stderr.Len() != 0 {
		t.Errorf("version stderr = %q, want empty", stderr.String())
	}
}

func TestVersionCommandRejectsArguments(t *testing.T) {
	t.Parallel()

	root := newRootCommand(buildInfo{version: "1.2.3"})
	root.SetArgs([]string{"version", "extra"})

	if err := root.ExecuteContext(t.Context()); err == nil {
		t.Fatal("ExecuteContext() error = nil, want argument validation error")
	}
}
