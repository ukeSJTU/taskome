package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
)

const (
	exitSuccess = 0
	exitFailure = 1
	exitUsage   = 2
)

type usageError struct {
	err error
}

func (e *usageError) Error() string {
	return e.err.Error()
}

func (e *usageError) Unwrap() error {
	return e.err
}

type buildInfo struct {
	version string
	commit  string
	date    string
}

// Execute runs the command using the process arguments and standard streams.
func Execute() int {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	return execute(ctx, os.Args[1:], os.Stdout, os.Stderr, currentBuildInfo())
}

func execute(
	ctx context.Context,
	args []string,
	stdout io.Writer,
	stderr io.Writer,
	info buildInfo,
) int {
	root := newRootCommand(info)
	root.SetArgs(args)
	root.SetOut(stdout)
	root.SetErr(stderr)

	if err := root.ExecuteContext(ctx); err != nil {
		_, _ = fmt.Fprintf(root.ErrOrStderr(), "Error: %v\n", err)

		var usageErr *usageError
		if errors.As(err, &usageErr) {
			return exitUsage
		}

		return exitFailure
	}

	return exitSuccess
}

func newRootCommand(info buildInfo) *cobra.Command {
	root := &cobra.Command{
		Use:           "taskome",
		Short:         "Taskome command-line interface",
		Args:          asUsageError(cobra.NoArgs),
		SilenceUsage:  true,
		SilenceErrors: true,
		Version:       info.version,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return cmd.Help()
		},
	}
	root.SetFlagErrorFunc(func(_ *cobra.Command, err error) error {
		return &usageError{err: err}
	})

	root.SetVersionTemplate("taskome {{.Version}}\n")
	root.AddCommand(newCompletionCommand(), newVersionCommand(info))

	return root
}

func asUsageError(validate cobra.PositionalArgs) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		if err := validate(cmd, args); err != nil {
			return &usageError{err: err}
		}
		return nil
	}
}
