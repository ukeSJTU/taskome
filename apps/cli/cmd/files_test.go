package cmd

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	generated "github.com/ukeSJTU/taskome/apps/cli/internal/api/generated"
)

type fileTestAPI struct {
	created   generated.CreateSavedFileUploadJSONRequestBody
	confirmed openapi_types.UUID
}

func (api *fileTestAPI) CreateSavedFileUpload(_ context.Context, body generated.CreateSavedFileUploadJSONRequestBody, _ ...generated.RequestEditorFn) (*http.Response, error) {
	api.created = body
	return jsonHTTPResponse(http.StatusCreated, `{"id":"00000000-0000-4000-8000-000000000002","uploadUrl":"https://object.example/upload"}`), nil
}
func (api *fileTestAPI) ConfirmSavedFileUpload(_ context.Context, id openapi_types.UUID, _ ...generated.RequestEditorFn) (*http.Response, error) {
	api.confirmed = id
	return jsonHTTPResponse(http.StatusOK, `{}`), nil
}
func (api *fileTestAPI) GetSavedFileDownload(_ context.Context, _ openapi_types.UUID, _ ...generated.RequestEditorFn) (*http.Response, error) {
	return jsonHTTPResponse(http.StatusOK, `{"downloadUrl":"https://object.example/download"}`), nil
}
func jsonHTTPResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Status: http.StatusText(status), Body: io.NopCloser(bytes.NewBufferString(body)), Header: http.Header{"Content-Type": {"application/json"}}}
}

type doerFunc func(*http.Request) (*http.Response, error)

func (fn doerFunc) Do(request *http.Request) (*http.Response, error) { return fn(request) }

func TestFilesRequireLogin(t *testing.T) {
	command := newFilesCommandWithDependencies(fileCommandDependencies{
		loadConfig: func() (cliConfig, error) { return cliConfig{}, nil },
		newAPI: func(cliConfig) (savedFilesAPI, error) {
			t.Fatal("API must not be constructed without login")
			return nil, nil
		},
		transport: http.DefaultClient,
	})
	command.SetArgs([]string{"upload", "--project", "00000000-0000-4000-8000-000000000001", "input.dat"})
	if err := command.Execute(); err == nil || err.Error() != "not logged in; run taskome login --api-key <key>" {
		t.Fatalf("login error = %v", err)
	}
}

func TestFilesUploadUsesInjectableAPIAndTransport(t *testing.T) {
	path := filepath.Join(t.TempDir(), "input.dat")
	if err := os.WriteFile(path, []byte("ATOM\n"), 0600); err != nil {
		t.Fatal(err)
	}
	api := &fileTestAPI{}
	var uploaded []byte
	command := newFilesCommandWithDependencies(fileCommandDependencies{
		loadConfig: func() (cliConfig, error) { return cliConfig{APIKey: "key", Server: "https://api.example"}, nil },
		newAPI:     func(cliConfig) (savedFilesAPI, error) { return api, nil },
		transport: doerFunc(func(request *http.Request) (*http.Response, error) {
			if request.Method != http.MethodPut || request.URL.String() != "https://object.example/upload" {
				t.Fatalf("object request = %s %s", request.Method, request.URL)
			}
			uploaded, _ = io.ReadAll(request.Body)
			return jsonHTTPResponse(http.StatusOK, ""), nil
		}),
	})
	var stdout bytes.Buffer
	command.SetOut(&stdout)
	command.SetArgs([]string{"upload", "--project", "00000000-0000-4000-8000-000000000001", path})
	if err := command.Execute(); err != nil {
		t.Fatal(err)
	}
	if api.created.ProjectId != uuid.MustParse("00000000-0000-4000-8000-000000000001") || string(uploaded) != "ATOM\n" {
		t.Fatalf("unexpected upload: %#v %q", api.created, uploaded)
	}
	if api.confirmed != uuid.MustParse("00000000-0000-4000-8000-000000000002") {
		t.Fatalf("confirm = %s", api.confirmed)
	}
}

func TestFilesDownloadUsesInjectableTransport(t *testing.T) {
	path := filepath.Join(t.TempDir(), "output.dat")
	command := newFilesCommandWithDependencies(fileCommandDependencies{
		loadConfig: func() (cliConfig, error) {
			return cliConfig{APIKey: "key", Server: "https://api.example"}, nil
		},
		newAPI: func(cliConfig) (savedFilesAPI, error) { return &fileTestAPI{}, nil },
		transport: doerFunc(func(request *http.Request) (*http.Response, error) {
			if request.Method != http.MethodGet || request.URL.String() != "https://object.example/download" {
				t.Fatalf("object request = %s %s", request.Method, request.URL)
			}
			return &http.Response{StatusCode: http.StatusOK, Status: "200 OK", Body: io.NopCloser(bytes.NewBufferString("ATOM\n"))}, nil
		}),
	})
	command.SetArgs([]string{"download", "00000000-0000-4000-8000-000000000002", path})
	if err := command.Execute(); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(path)
	if err != nil || string(content) != "ATOM\n" {
		t.Fatalf("downloaded content = %q, %v", content, err)
	}
}
