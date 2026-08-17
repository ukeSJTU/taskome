package cli

import (
	"context"
	"fmt"
	"io"
)

// Execute runs Taskome's command-line interface and returns its process exit code.
func Execute(ctx context.Context, args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	return executeWith(ctx, args, stdin, stdout, stderr, defaultCommandDependencies())
}

func executeWith(
	ctx context.Context,
	args []string,
	stdin io.Reader,
	stdout, stderr io.Writer,
	dependencies commandDependencies,
) int {
	command := newRootCommand(dependencies)
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
