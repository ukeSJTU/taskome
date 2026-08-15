package cli

import "github.com/spf13/cobra"

// Version is supplied by the release build through -ldflags.
var Version = "devel"

func newRootCommand() *cobra.Command {
	return &cobra.Command{
		Use:           "taskome",
		Short:         "Taskome command-line interface",
		SilenceErrors: true,
		SilenceUsage:  true,
		Args:          cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return command.Help()
		},
		Version: Version,
	}
}
