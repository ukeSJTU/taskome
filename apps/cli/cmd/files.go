package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/spf13/cobra"
	generated "github.com/ukeSJTU/taskome/apps/cli/internal/api/generated"
)

const defaultServer = "http://localhost:3000"

type httpDoer interface {
	Do(*http.Request) (*http.Response, error)
}

type savedFilesAPI interface {
	CreateSavedFileUpload(context.Context, generated.CreateSavedFileUploadJSONRequestBody, ...generated.RequestEditorFn) (*http.Response, error)
	ConfirmSavedFileUpload(context.Context, openapi_types.UUID, ...generated.RequestEditorFn) (*http.Response, error)
	GetSavedFileDownload(context.Context, openapi_types.UUID, ...generated.RequestEditorFn) (*http.Response, error)
}

type fileCommandDependencies struct {
	loadConfig func() (cliConfig, error)
	newAPI     func(cliConfig) (savedFilesAPI, error)
	transport  httpDoer
}

type cliConfig struct {
	APIKey string `json:"apiKey"`
	Server string `json:"server"`
}
type savedFileUpload struct {
	ID        string `json:"id"`
	UploadURL string `json:"uploadUrl"`
}
type savedFileDownload struct {
	DownloadURL string `json:"downloadUrl"`
}

func configPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "taskome", "config.json"), nil
}
func loadConfig() (cliConfig, error) {
	path, err := configPath()
	if err != nil {
		return cliConfig{}, err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return cliConfig{}, nil
	}
	if err != nil {
		return cliConfig{}, err
	}
	var config cliConfig
	return config, json.Unmarshal(data, &config)
}
func saveConfig(config cliConfig) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
func requireConfig(load func() (cliConfig, error)) (cliConfig, error) {
	config, err := load()
	if err != nil {
		return cliConfig{}, err
	}
	if config.APIKey == "" {
		return cliConfig{}, fmt.Errorf("not logged in; run taskome login --api-key <key>")
	}
	if config.Server == "" {
		config.Server = defaultServer
	}
	return config, nil
}

func newSavedFilesAPI(config cliConfig, transport httpDoer) (savedFilesAPI, error) {
	return generated.NewClient(
		config.Server,
		generated.WithHTTPClient(transport),
		generated.WithRequestEditorFn(func(_ context.Context, request *http.Request) error {
			request.Header.Set("Authorization", "Bearer "+config.APIKey)
			return nil
		}),
	)
}
func apiError(response *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 8192))
	return fmt.Errorf("taskome API returned %s: %s", response.Status, bytes.TrimSpace(body))
}

func newLoginCommand() *cobra.Command {
	var key, server string
	command := &cobra.Command{Use: "login", Short: "Store an API key for Taskome commands", RunE: func(_ *cobra.Command, _ []string) error {
		if key == "" {
			return &usageError{fmt.Errorf("--api-key is required")}
		}
		if server == "" {
			server = defaultServer
		}
		if err := saveConfig(cliConfig{APIKey: key, Server: server}); err != nil {
			return err
		}
		return nil
	}}
	command.Flags().StringVar(&key, "api-key", "", "Taskome API key")
	command.Flags().StringVar(&server, "server", defaultServer, "Taskome server URL")
	return command
}
func newFilesCommand() *cobra.Command {
	return newFilesCommandWithDependencies(fileCommandDependencies{
		loadConfig: loadConfig,
		newAPI: func(config cliConfig) (savedFilesAPI, error) {
			return newSavedFilesAPI(config, http.DefaultClient)
		},
		transport: http.DefaultClient,
	})
}
func newFilesCommandWithDependencies(dependencies fileCommandDependencies) *cobra.Command {
	command := &cobra.Command{Use: "files", Short: "Upload and download Saved Files"}
	command.AddCommand(newFileUploadCommand(dependencies), newFileDownloadCommand(dependencies))
	return command
}
func newFileUploadCommand(dependencies fileCommandDependencies) *cobra.Command {
	var projectID string
	command := &cobra.Command{Use: "upload <path>", Args: asUsageError(cobra.ExactArgs(1)), RunE: func(command *cobra.Command, args []string) error {
		if projectID == "" {
			return &usageError{fmt.Errorf("--project is required")}
		}
		config, err := requireConfig(dependencies.loadConfig)
		if err != nil {
			return err
		}
		api, err := dependencies.newAPI(config)
		if err != nil {
			return err
		}
		file, err := os.Open(args[0])
		if err != nil {
			return err
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil {
			return err
		}
		parsedProjectID, err := uuid.Parse(projectID)
		if err != nil {
			return &usageError{fmt.Errorf("--project must be a UUID")}
		}
		response, err := api.CreateSavedFileUpload(command.Context(), generated.CreateSavedFileUpload{
			Filename: filepath.Base(args[0]), ProjectId: parsedProjectID, SizeBytes: int(info.Size()),
		})
		if err != nil {
			return err
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusCreated {
			return apiError(response)
		}
		var upload savedFileUpload
		if err := json.NewDecoder(response.Body).Decode(&upload); err != nil {
			return err
		}
		put, err := http.NewRequestWithContext(command.Context(), http.MethodPut, upload.UploadURL, file)
		if err != nil {
			return err
		}
		put.ContentLength = info.Size()
		put.Header.Set("If-None-Match", "*")
		putResponse, err := dependencies.transport.Do(put)
		if err != nil {
			return err
		}
		putResponse.Body.Close()
		if putResponse.StatusCode/100 != 2 {
			return fmt.Errorf("object storage returned %s", putResponse.Status)
		}
		parsedUploadID, err := uuid.Parse(upload.ID)
		if err != nil {
			return fmt.Errorf("taskome API returned an invalid Saved File ID")
		}
		confirm, err := api.ConfirmSavedFileUpload(command.Context(), parsedUploadID)
		if err != nil {
			return err
		}
		defer confirm.Body.Close()
		if confirm.StatusCode != http.StatusOK {
			return apiError(confirm)
		}
		_, err = fmt.Fprintln(command.OutOrStdout(), upload.ID)
		return err
	}}
	command.Flags().StringVar(&projectID, "project", "", "Target Project ID")
	return command
}
func newFileDownloadCommand(dependencies fileCommandDependencies) *cobra.Command {
	return &cobra.Command{Use: "download <saved-file-id> <path>", Args: asUsageError(cobra.ExactArgs(2)), RunE: func(command *cobra.Command, args []string) error {
		config, err := requireConfig(dependencies.loadConfig)
		if err != nil {
			return err
		}
		api, err := dependencies.newAPI(config)
		if err != nil {
			return err
		}
		parsedFileID, err := uuid.Parse(args[0])
		if err != nil {
			return &usageError{fmt.Errorf("saved-file-id must be a UUID")}
		}
		response, err := api.GetSavedFileDownload(command.Context(), parsedFileID)
		if err != nil {
			return err
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK {
			return apiError(response)
		}
		var download savedFileDownload
		if err := json.NewDecoder(response.Body).Decode(&download); err != nil {
			return err
		}
		request, err := http.NewRequestWithContext(command.Context(), http.MethodGet, download.DownloadURL, nil)
		if err != nil {
			return err
		}
		source, err := dependencies.transport.Do(request)
		if err != nil {
			return err
		}
		defer source.Body.Close()
		if source.StatusCode != http.StatusOK {
			return fmt.Errorf("object storage returned %s", source.Status)
		}
		destination, err := os.Create(args[1])
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(destination, source.Body)
		closeErr := destination.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	}}
}
