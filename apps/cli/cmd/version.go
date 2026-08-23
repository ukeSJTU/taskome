package cmd

import (
	"fmt"
	"runtime"

	"github.com/spf13/cobra"
)

var (
	version = "dev"
	commit  = "unknown"
	date    = "unknown"
)

func currentBuildInfo() buildInfo {
	return buildInfo{
		version: version,
		commit:  commit,
		date:    date,
	}
}

func newVersionCommand(info buildInfo) *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print version information",
		Args:  asUsageError(cobra.NoArgs),
		RunE: func(cmd *cobra.Command, _ []string) error {
			_, err := fmt.Fprintf(
				cmd.OutOrStdout(),
				"taskome %s\ncommit: %s\nbuilt: %s\ngo: %s\n",
				info.version,
				info.commit,
				info.date,
				runtime.Version(),
			)
			return err
		},
	}
}
