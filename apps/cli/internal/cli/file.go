package cli

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
	"github.com/ukeSJTU/taskome/apps/cli/internal/gateway"
	generated "github.com/ukeSJTU/taskome/apps/cli/internal/gateway/generated"
)

const maxInputFileBytes = 50 * 1024 * 1024

func newFileCommand(dependencies commandDependencies) *cobra.Command {
	command := &cobra.Command{
		Use:   "file",
		Short: "Upload and download Input Files",
		Args:  cobra.NoArgs,
	}
	command.AddCommand(newFileUploadCommand(dependencies), newFileDownloadCommand(dependencies))
	return command
}

func newFileUploadCommand(dependencies commandDependencies) *cobra.Command {
	return &cobra.Command{
		Use:   "upload PATH",
		Short: "Upload a local file as an Input File",
		Args:  cobra.ExactArgs(1),
		RunE: func(command *cobra.Command, args []string) error {
			file, info, err := openInputFile(args[0])
			if err != nil {
				return err
			}
			defer file.Close()

			apiClient, err := newAuthenticatedGatewayClient(command.Context(), dependencies)
			if err != nil {
				return err
			}
			response, err := apiClient.CreateInputFileWithResponse(command.Context(), generated.CreateInputFileRequest{
				OriginalFilename: filepath.Base(args[0]),
				SizeBytes:        int(info.Size()),
			})
			if err != nil {
				return fmt.Errorf("create Input File: %w", err)
			}
			if response == nil || response.JSON201 == nil {
				return gatewayResponseError("create Input File", gatewayFailure(response))
			}

			inputFile := response.JSON201
			progress := newTransferProgress(command.ErrOrStderr(), dependencies.isTerminal, "Uploading", filepath.Base(args[0]), info.Size())
			err = putInputFile(command.Context(), dependencies.httpClient, inputFile.UploadUrl, progress.reader(file), info.Size())
			progress.complete()
			if err != nil {
				cleanupErr := deleteInputFile(inputFile.Id, dependencies)
				if cleanupErr != nil {
					return fmt.Errorf("upload Input File %s: %w; cleanup failed: %v", inputFile.Id, err, cleanupErr)
				}
				return fmt.Errorf("upload Input File: %w", err)
			}
			_, err = fmt.Fprintln(command.OutOrStdout(), inputFile.Id)
			return err
		},
	}
}

func newFileDownloadCommand(dependencies commandDependencies) *cobra.Command {
	var force bool
	command := &cobra.Command{
		Use:   "download INPUT_FILE_ID PATH",
		Short: "Download a caller-owned Input File",
		Args:  cobra.ExactArgs(2),
		RunE: func(command *cobra.Command, args []string) error {
			inputFileID, err := uuid.Parse(args[0])
			if err != nil {
				return fmt.Errorf("INPUT_FILE_ID must be a UUID")
			}
			if err := validateDownloadDestination(args[1], force); err != nil {
				return err
			}
			apiClient, err := newAuthenticatedGatewayClient(command.Context(), dependencies)
			if err != nil {
				return err
			}
			response, err := apiClient.GetInputFileDownloadUrlWithResponse(command.Context(), inputFileID)
			if err != nil {
				return fmt.Errorf("get Input File download URL: %w", err)
			}
			if response == nil || response.JSON200 == nil {
				return gatewayResponseError("get Input File download URL", gatewayFailure(response))
			}
			progress := newTransferProgress(command.ErrOrStderr(), dependencies.isTerminal, "Downloading", filepath.Base(args[1]), -1)
			err = downloadInputFile(command.Context(), dependencies.httpClient, response.JSON200.DownloadUrl, args[1], progress)
			progress.complete()
			return err
		},
	}
	command.Flags().BoolVar(&force, "force", false, "replace an existing destination file")
	return command
}

func openInputFile(path string) (*os.File, os.FileInfo, error) {
	if path == "-" {
		return nil, nil, errors.New("stdin upload is not supported")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, fmt.Errorf("open source file: %w", err)
	}
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, nil, fmt.Errorf("inspect source file: %w", err)
	}
	if !info.Mode().IsRegular() {
		file.Close()
		return nil, nil, errors.New("source path must be a regular file")
	}
	if info.Size() == 0 {
		file.Close()
		return nil, nil, errors.New("source file must not be empty")
	}
	if info.Size() > maxInputFileBytes {
		file.Close()
		return nil, nil, fmt.Errorf("source file exceeds the %d MiB limit", maxInputFileBytes/(1024*1024))
	}
	if filename := filepath.Base(path); filename == "." || filename == string(filepath.Separator) || len(filename) > 255 {
		file.Close()
		return nil, nil, errors.New("source filename is not accepted by the Input File API")
	}
	return file, info, nil
}

func newAuthenticatedGatewayClient(ctx context.Context, dependencies commandDependencies) (*generated.ClientWithResponses, error) {
	gatewayURL, err := dependencies.configuration.gatewayURL()
	if err != nil {
		return nil, err
	}
	authentication, err := resolveGatewayAuthentication(ctx, dependencies.credentials, dependencies.oauth, gatewayURL, os.Getenv("TASKOME_API_KEY"))
	if err != nil {
		return nil, fmt.Errorf("resolve gateway credentials: %w", err)
	}
	if authentication.personalAPIKey != "" {
		return gateway.NewClient(gatewayURL, authentication.personalAPIKey, dependencies.httpClient)
	}
	return gateway.NewOAuthClient(gatewayURL, authentication.accessToken, dependencies.httpClient)
}

func putInputFile(ctx context.Context, client *http.Client, uploadURL string, body io.Reader, size int64) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, io.NopCloser(body))
	if err != nil {
		return errors.New("create storage upload request")
	}
	request.ContentLength = size
	request.Header.Set("If-None-Match", "*")
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("send storage upload: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return storageResponseError("upload", response)
	}
	return nil
}

func deleteInputFile(id uuid.UUID, dependencies commandDependencies) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	apiClient, err := newAuthenticatedGatewayClient(ctx, dependencies)
	if err != nil {
		return err
	}
	response, err := apiClient.DeleteInputFileWithResponse(ctx, id)
	if err != nil {
		return err
	}
	if response == nil || response.StatusCode() != http.StatusNoContent {
		return gatewayResponseError("delete Input File", gatewayFailure(response))
	}
	return nil
}

func validateDownloadDestination(path string, force bool) error {
	if path == "-" {
		return errors.New("stdout download is not supported")
	}
	parent := filepath.Dir(path)
	parentInfo, err := os.Stat(parent)
	if err != nil {
		return fmt.Errorf("destination parent directory: %w", err)
	}
	if !parentInfo.IsDir() {
		return errors.New("destination parent must be a directory")
	}
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("inspect destination: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return errors.New("destination must not be a symlink")
	}
	if !force {
		return errors.New("destination already exists; use --force to replace it")
	}
	return nil
}

func downloadInputFile(ctx context.Context, client *http.Client, downloadURL, destination string, progress *transferProgress) error {
	for attempt := 0; attempt < 3; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		progress.reset()
		temporary, err := os.CreateTemp(filepath.Dir(destination), "."+filepath.Base(destination)+".tmp-*")
		if err != nil {
			return fmt.Errorf("create temporary download: %w", err)
		}
		completed, retry, err := downloadAttempt(ctx, client, downloadURL, temporary, progress)
		if closeErr := temporary.Close(); err == nil && closeErr != nil {
			err = fmt.Errorf("close temporary download: %w", closeErr)
		}
		if err != nil || !completed {
			_ = os.Remove(temporary.Name())
			if retry && attempt < 2 {
				if err := waitForRetry(ctx, attempt); err != nil {
					return err
				}
				continue
			}
			return err
		}
		if err := os.Rename(temporary.Name(), destination); err != nil {
			_ = os.Remove(temporary.Name())
			return fmt.Errorf("replace destination with completed download: %w", err)
		}
		return nil
	}
	return errors.New("download retries exhausted")
}

func downloadAttempt(ctx context.Context, client *http.Client, downloadURL string, destination *os.File, progress *transferProgress) (bool, bool, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return false, false, errors.New("create storage download request")
	}
	response, err := client.Do(request)
	if err != nil {
		return false, true, fmt.Errorf("send storage download: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return false, retryableStatus(response.StatusCode), storageResponseError("download", response)
	}
	progress.setTotal(response.ContentLength)
	if retry, err := copyDownload(destination, progress.reader(response.Body)); err != nil {
		return false, retry, fmt.Errorf("write download: %w", err)
	}
	return true, false, nil
}

func copyDownload(destination io.Writer, source io.Reader) (bool, error) {
	buffer := make([]byte, 32*1024)
	for {
		read, readErr := source.Read(buffer)
		if read > 0 {
			if _, writeErr := destination.Write(buffer[:read]); writeErr != nil {
				return false, writeErr
			}
		}
		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				return false, nil
			}
			return true, readErr
		}
	}
}

func retryableStatus(status int) bool {
	return status == http.StatusRequestTimeout || status == http.StatusTooManyRequests || status >= http.StatusInternalServerError
}

func waitForRetry(ctx context.Context, attempt int) error {
	timer := time.NewTimer(time.Duration(attempt+1) * 100 * time.Millisecond)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

type transferProgress struct {
	writer    io.Writer
	enabled   bool
	operation string
	filename  string
	total     int64
	completed int64
}

func newTransferProgress(writer io.Writer, isTerminal func(io.Writer) bool, operation, filename string, total int64) *transferProgress {
	enabled := isTerminal != nil && isTerminal(writer)
	return &transferProgress{writer: writer, enabled: enabled, operation: operation, filename: filename, total: total}
}

func (progress *transferProgress) setTotal(total int64) {
	if progress.enabled && total >= 0 {
		progress.total = total
	}
}

func (progress *transferProgress) reset() {
	progress.completed = 0
}

func (progress *transferProgress) reader(reader io.Reader) io.Reader {
	return progressReader{reader: reader, progress: progress}
}

func (progress *transferProgress) render() {
	if !progress.enabled {
		return
	}
	if progress.total > 0 {
		_, _ = fmt.Fprintf(progress.writer, "\r%s %s: %d/%d bytes (%.0f%%)", progress.operation, progress.filename, progress.completed, progress.total, float64(progress.completed)*100/float64(progress.total))
		return
	}
	_, _ = fmt.Fprintf(progress.writer, "\r%s %s: %d bytes", progress.operation, progress.filename, progress.completed)
}

func (progress *transferProgress) complete() {
	if progress.enabled {
		_, _ = fmt.Fprintln(progress.writer)
	}
}

type progressReader struct {
	reader   io.Reader
	progress *transferProgress
}

func (reader progressReader) Read(buffer []byte) (int, error) {
	n, err := reader.reader.Read(buffer)
	if n > 0 {
		reader.progress.completed += int64(n)
		reader.progress.render()
	}
	return n, err
}

func storageResponseError(operation string, response *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
	summary := strings.TrimSpace(strings.Map(func(character rune) rune {
		if character < 32 && character != '\n' && character != '\t' {
			return -1
		}
		return character
	}, string(body)))
	if summary == "" || containsSensitiveValue(summary) {
		return fmt.Errorf("storage %s failed with status %d", operation, response.StatusCode)
	}
	return fmt.Errorf("storage %s failed with status %d: %s", operation, response.StatusCode, summary)
}

func gatewayResponseError(operation string, failure gatewayResponseFailure) error {
	status := failure.status
	problem := failure.problem
	if problem != nil {
		detail := strings.TrimSpace(problem.Detail)
		if detail != "" && !containsSensitiveValue(detail) {
			return fmt.Errorf("%s failed with status %d: %s", operation, status, detail)
		}
		if problem.Title != "" && !containsSensitiveValue(problem.Title) {
			return fmt.Errorf("%s failed with status %d: %s", operation, status, problem.Title)
		}
	}
	return fmt.Errorf("%s failed with status %d", operation, status)
}

type gatewayResponseFailure struct {
	status  int
	problem *generated.ProblemDetails
}

func gatewayFailure(response interface{}) gatewayResponseFailure {
	switch typed := response.(type) {
	case *generated.CreateInputFileResponse:
		if typed != nil {
			return gatewayResponseFailure{typed.StatusCode(), firstProblem(typed.ApplicationproblemJSON400, typed.ApplicationproblemJSON401, typed.ApplicationproblemJSON422, typed.ApplicationproblemJSON503, typed.ApplicationproblemJSONDefault)}
		}
	case *generated.DeleteInputFileResponse:
		if typed != nil {
			return gatewayResponseFailure{typed.StatusCode(), firstProblem(typed.ApplicationproblemJSON400, typed.ApplicationproblemJSON401, typed.ApplicationproblemJSON404, typed.ApplicationproblemJSON422, typed.ApplicationproblemJSON503, typed.ApplicationproblemJSONDefault)}
		}
	case *generated.GetInputFileDownloadUrlResponse:
		if typed != nil {
			return gatewayResponseFailure{typed.StatusCode(), firstProblem(typed.ApplicationproblemJSON400, typed.ApplicationproblemJSON401, typed.ApplicationproblemJSON404, typed.ApplicationproblemJSON422, typed.ApplicationproblemJSON503, typed.ApplicationproblemJSONDefault)}
		}
	}
	return gatewayResponseFailure{}
}

func containsSensitiveValue(value string) bool {
	lower := strings.ToLower(value)
	return strings.Contains(lower, "http://") || strings.Contains(lower, "https://") || strings.Contains(lower, "authorization") || strings.Contains(lower, "api-key") || strings.Contains(lower, "api_key") || strings.Contains(lower, "bearer ")
}

func firstProblem(problems ...*generated.ProblemDetails) *generated.ProblemDetails {
	for _, problem := range problems {
		if problem != nil {
			return problem
		}
	}
	return nil
}
