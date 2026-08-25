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

	"github.com/spf13/cobra"
)

const defaultServer = "http://localhost:3000"

type httpDoer interface {
	Do(*http.Request) (*http.Response, error)
}

var fileHTTPClient httpDoer = http.DefaultClient

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
func requireConfig() (cliConfig, error) {
	config, err := loadConfig()
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
func request(ctx context.Context, config cliConfig, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, config.Server+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+config.APIKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return fileHTTPClient.Do(req)
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
	command := &cobra.Command{Use: "files", Short: "Upload and download Saved Files"}
	command.AddCommand(newFileUploadCommand(), newFileDownloadCommand())
	return command
}
func newFileUploadCommand() *cobra.Command {
	var projectID string
	command := &cobra.Command{Use: "upload <path>", Args: asUsageError(cobra.ExactArgs(1)), RunE: func(command *cobra.Command, args []string) error {
		if projectID == "" {
			return &usageError{fmt.Errorf("--project is required")}
		}
		config, err := requireConfig()
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
		body, _ := json.Marshal(map[string]any{"projectId": projectID, "filename": filepath.Base(args[0]), "sizeBytes": info.Size()})
		response, err := request(command.Context(), config, http.MethodPost, "/api/v1/saved-files/uploads", bytes.NewReader(body))
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
		putResponse, err := http.DefaultClient.Do(put)
		if err != nil {
			return err
		}
		putResponse.Body.Close()
		if putResponse.StatusCode/100 != 2 {
			return fmt.Errorf("object storage returned %s", putResponse.Status)
		}
		confirm, err := request(command.Context(), config, http.MethodPost, "/api/v1/saved-files/"+upload.ID+"/confirm", nil)
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
func newFileDownloadCommand() *cobra.Command {
	return &cobra.Command{Use: "download <saved-file-id> <path>", Args: asUsageError(cobra.ExactArgs(2)), RunE: func(command *cobra.Command, args []string) error {
		config, err := requireConfig()
		if err != nil {
			return err
		}
		response, err := request(command.Context(), config, http.MethodPost, "/api/v1/saved-files/"+args[0]+"/download", nil)
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
		source, err := http.Get(download.DownloadURL)
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
