package cli

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/ukeSJTU/taskome/apps/cli/internal/gateway"
	generated "github.com/ukeSJTU/taskome/apps/cli/internal/gateway/generated"
	"golang.org/x/term"
)

// Version is supplied by the release build through -ldflags.
var Version = "devel"

type commandDependencies struct {
	configuration configuration
	credentials   credentialStore
	httpClient    *http.Client
	oauth         oauthClient
	isTerminal    func(io.Writer) bool
}

func defaultCommandDependencies() commandDependencies {
	return commandDependencies{
		configuration: defaultConfiguration(),
		credentials:   defaultCredentialStore(),
		httpClient:    http.DefaultClient,
		oauth:         defaultOAuthClient(),
		isTerminal: func(writer io.Writer) bool {
			file, ok := writer.(*os.File)
			return ok && term.IsTerminal(int(file.Fd()))
		},
	}
}

func newRootCommand(dependencies commandDependencies) *cobra.Command {
	command := &cobra.Command{
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
	command.AddCommand(newCompletionCommand())
	command.AddCommand(newConfigCommand(dependencies.configuration))
	command.AddCommand(newFileCommand(dependencies))
	command.AddCommand(newLoginCommand(dependencies.configuration, dependencies.credentials, dependencies.oauth))
	command.AddCommand(newLogoutCommand(dependencies.configuration, dependencies.credentials, dependencies.oauth))
	command.AddCommand(newWhoAmICommand(dependencies.configuration, dependencies.credentials, dependencies.httpClient, dependencies.oauth))

	return command
}

func newWhoAmICommand(
	configuration configuration,
	credentials credentialStore,
	httpClient *http.Client,
	oauth oauthClient,
) *cobra.Command {
	return &cobra.Command{
		Use:   "whoami",
		Short: "Show the Taskome identity for the active credential",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			gatewayURL, err := configuration.gatewayURL()
			if err != nil {
				return err
			}
			authentication, err := resolveGatewayAuthentication(
				command.Context(),
				credentials,
				oauth,
				gatewayURL,
				os.Getenv("TASKOME_API_KEY"),
			)
			if err != nil {
				return fmt.Errorf("resolve gateway credentials: %w", err)
			}
			if authentication.personalAPIKey != "" {
				apiClient, err := gateway.NewClient(gatewayURL, authentication.personalAPIKey, httpClient)
				if err != nil {
					return err
				}
				response, err := apiClient.GetCurrentIdentityWithResponse(command.Context())
				return printIdentity(command, response, err)
			}
			oauthClient, err := gateway.NewOAuthClient(gatewayURL, authentication.accessToken, httpClient)
			if err != nil {
				return err
			}
			response, err := oauthClient.GetCurrentIdentityWithResponse(command.Context())
			return printIdentity(command, response, err)
		},
	}
}

func printIdentity(command *cobra.Command, response *generated.GetCurrentIdentityResponse, err error) error {
	if err != nil {
		return fmt.Errorf("load current identity: %w", err)
	}
	if response == nil || response.JSON200 == nil {
		if response != nil && response.HTTPResponse != nil {
			return fmt.Errorf("gateway returned unexpected response status %d", response.HTTPResponse.StatusCode)
		}
		return errors.New("gateway returned an empty identity response")
	}
	_, err = fmt.Fprintf(command.OutOrStdout(), "%s (%s)\n", response.JSON200.UserId, response.JSON200.CredentialKind)
	return err
}

func newConfigCommand(configuration configuration) *cobra.Command {
	command := &cobra.Command{Use: "config", Short: "Read and update Taskome configuration"}
	getCommand := &cobra.Command{
		Use:   "get gateway-url",
		Short: "Print the configured Gateway URL",
		Args:  cobra.ExactArgs(1),
		RunE: func(command *cobra.Command, args []string) error {
			if args[0] != "gateway-url" {
				return fmt.Errorf("unknown configuration key %q", args[0])
			}
			gatewayURL, err := configuration.gatewayURL()
			if err != nil {
				return err
			}
			_, err = fmt.Fprintln(command.OutOrStdout(), gatewayURL)
			return err
		},
	}
	setCommand := &cobra.Command{
		Use:   "set gateway-url URL",
		Short: "Update the configured Gateway URL",
		Args:  cobra.ExactArgs(2),
		RunE: func(command *cobra.Command, args []string) error {
			if args[0] != "gateway-url" {
				return fmt.Errorf("unknown configuration key %q", args[0])
			}
			if err := configuration.setGatewayURL(args[1]); err != nil {
				return err
			}
			_, err := fmt.Fprintln(command.OutOrStdout(), "gateway_url updated")
			return err
		},
	}
	command.AddCommand(getCommand, setCommand)
	return command
}

func newLoginCommand(
	configuration configuration,
	credentials credentialStore,
	oauth oauthClient,
) *cobra.Command {
	var apiKey bool
	command := &cobra.Command{
		Use:   "login",
		Short: "Sign in to Taskome",
		RunE: func(command *cobra.Command, _ []string) error {
			gatewayURL, err := configuration.gatewayURL()
			if err != nil {
				return err
			}
			if !apiKey {
				tokens, err := oauth.login(command.Context(), gatewayURL)
				if err != nil {
					return fmt.Errorf(
						"interactive login failed: %w; use taskome login --api-key for SSH or other no-browser environments",
						err,
					)
				}
				if err := credentials.setOAuthTokens(gatewayURL, tokens); err != nil {
					return err
				}
				_, err = fmt.Fprintln(command.OutOrStdout(), "Signed in to Taskome.")
				return err
			}
			_, err = fmt.Fprint(command.ErrOrStderr(), "Personal API Key: ")
			if err != nil {
				return err
			}
			apiKeyValue, err := bufio.NewReader(command.InOrStdin()).ReadString('\n')
			if err != nil && !errors.Is(err, io.EOF) {
				return fmt.Errorf("read Personal API Key: %w", err)
			}
			apiKeyValue = strings.TrimSpace(apiKeyValue)
			if apiKeyValue == "" {
				return fmt.Errorf("personal API Key must not be empty")
			}
			if err := credentials.setPersonalAPIKey(gatewayURL, apiKeyValue); err != nil {
				return err
			}
			_, err = fmt.Fprintln(command.OutOrStdout(), "Personal API Key saved for automation.")
			return err
		},
	}
	command.Flags().BoolVar(&apiKey, "api-key", false, "store a Personal API Key for automation")
	return command
}

func newLogoutCommand(
	configuration configuration,
	credentials credentialStore,
	oauth oauthClient,
) *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Remove local Taskome credentials",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			gatewayURL, err := configuration.gatewayURL()
			if err != nil {
				return err
			}
			if _, err := credentials.getPersonalAPIKey(gatewayURL); err == nil {
				if err := credentials.deletePersonalAPIKey(gatewayURL); err != nil {
					return err
				}
				_, err := fmt.Fprintln(command.OutOrStdout(), "Removed local Personal API Key.")
				return err
			} else if !errors.Is(err, errCredentialNotFound) {
				return err
			}
			if tokens, err := credentials.getOAuthTokens(gatewayURL); err == nil {
				if err := oauth.revoke(command.Context(), gatewayURL, tokens); err != nil {
					_, _ = fmt.Fprintf(command.ErrOrStderr(), "Could not revoke OAuth session: %v\n", err)
				}
				if err := credentials.deleteOAuthTokens(gatewayURL); err != nil {
					return err
				}
				_, err := fmt.Fprintln(command.OutOrStdout(), "Removed local OAuth credentials.")
				return err
			} else if !errors.Is(err, errCredentialNotFound) {
				return err
			}
			return fmt.Errorf("no local credentials found")
		},
	}
}
