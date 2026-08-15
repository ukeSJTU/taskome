package cli

import (
	"context"
	"fmt"
	"io"
)

// Execute runs Taskome's command-line interface and returns its process exit code.
func Execute(ctx context.Context, args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	command := newRootCommand()
	command.SetArgs(args)
	command.SetIn(stdin)
	command.SetOut(stdout)
	command.SetErr(stderr)
	command.SetContext(ctx)

	if err := command.Execute(); err != nil {
		_, _ = fmt.Fprintf(stderr, "Error: %v\n", err)
		return 2
	}
	return 0
}
