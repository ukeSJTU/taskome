package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

func newCompletionCommand() *cobra.Command {
	return &cobra.Command{
		Use:       "completion [bash|zsh|fish|powershell]",
		Short:     "Generate shell completion script",
		Args:      cobra.ExactArgs(1),
		ValidArgs: []string{"bash", "zsh", "fish", "powershell"},
		RunE: func(command *cobra.Command, args []string) error {
			switch args[0] {
			case "bash":
				return command.Root().GenBashCompletionV2(command.OutOrStdout(), true)
			case "zsh":
				return command.Root().GenZshCompletion(command.OutOrStdout())
			case "fish":
				return command.Root().GenFishCompletion(command.OutOrStdout(), true)
			case "powershell":
				return command.Root().GenPowerShellCompletionWithDesc(command.OutOrStdout())
			default:
				return fmt.Errorf("unsupported shell %q", args[0])
			}
		},
	}
}
