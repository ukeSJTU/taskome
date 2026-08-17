package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFileUploadCreatesInputFileAndStreamsBytesToStorage(t *testing.T) {
	const inputFileID = "8a1b1c1d-1e1f-4011-8011-121314151617"
	const payload = "ATOM  example\n"
	storage := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPut {
			t.Fatalf("storage method = %q, want PUT", request.Method)
		}
		if got := request.Header.Get("If-None-Match"); got != "*" {
			t.Fatalf("If-None-Match = %q, want *", got)
		}
		if got := request.Header.Get("X-API-Key"); got != "" {
			t.Fatalf("storage X-API-Key = %q, want empty", got)
		}
		if got := request.Header.Get("Authorization"); got != "" {
			t.Fatalf("storage Authorization = %q, want empty", got)
		}
		if got := request.ContentLength; got != int64(len(payload)) {
			t.Fatalf("storage Content-Length = %d, want %d", got, len(payload))
		}
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatalf("read storage body: %v", err)
		}
		if got := string(body); got != payload {
			t.Fatalf("storage body = %q, want %q", got, payload)
		}
		writer.WriteHeader(http.StatusOK)
	}))
	defer storage.Close()

	gateway := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/v1/input-files" {
			t.Fatalf("gateway request = %s %s, want POST /v1/input-files", request.Method, request.URL.Path)
		}
		if got := request.Header.Get("X-API-Key"); got != "taskome_ci-key" {
			t.Fatalf("gateway X-API-Key = %q, want API key", got)
		}
		var body struct {
			OriginalFilename string `json:"original_filename"`
			SizeBytes        int    `json:"size_bytes"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatalf("decode gateway body: %v", err)
		}
		if body.OriginalFilename != "source.pdb" || body.SizeBytes != len(payload) {
			t.Fatalf("gateway body = %#v", body)
		}
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(writer, `{"id":"`+inputFileID+`","upload_url":"`+storage.URL+`/object","expires_at":"2026-08-17T00:00:00Z"}`)
	}))
	defer gateway.Close()

	path := filepath.Join(t.TempDir(), "source.pdb")
	if err := os.WriteFile(path, []byte(payload), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TASKOME_API_KEY", "taskome_ci-key")
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	exitCode := executeWith(context.Background(), []string{"file", "upload", path}, strings.NewReader(""), &stdout, &stderr, commandDependencies{
		configuration: newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), gateway.URL),
		credentials:   newMemoryCredentialStore(),
		httpClient:    http.DefaultClient,
		oauth:         fakeOAuthClient{},
	})
	if exitCode != 0 {
		t.Fatalf("file upload exit code = %d; stderr = %q", exitCode, stderr.String())
	}
	if got := stdout.String(); got != inputFileID+"\n" {
		t.Fatalf("stdout = %q, want UUID only", got)
	}
	if got := stderr.String(); got != "" {
		t.Fatalf("stderr = %q, want empty", got)
	}
}

func TestFileDownloadStreamsBytesIntoDestinationWithoutStdout(t *testing.T) {
	const inputFileID = "8a1b1c1d-1e1f-4011-8011-121314151617"
	const payload = "ATOM  downloaded\n"
	storage := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			t.Fatalf("storage method = %q, want GET", request.Method)
		}
		if request.Header.Get("X-API-Key") != "" || request.Header.Get("Authorization") != "" {
			t.Fatal("storage request included Gateway credentials")
		}
		_, _ = io.WriteString(writer, payload)
	}))
	defer storage.Close()
	gateway := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet || request.URL.Path != "/v1/input-files/"+inputFileID+"/download-url" {
			t.Fatalf("gateway request = %s %s", request.Method, request.URL.Path)
		}
		if got := request.Header.Get("X-API-Key"); got != "taskome_ci-key" {
			t.Fatalf("gateway X-API-Key = %q, want API key", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"download_url":"`+storage.URL+`/object","expires_at":"2026-08-17T00:00:00Z"}`)
	}))
	defer gateway.Close()

	destination := filepath.Join(t.TempDir(), "downloaded.pdb")
	t.Setenv("TASKOME_API_KEY", "taskome_ci-key")
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	exitCode := executeWith(context.Background(), []string{"file", "download", inputFileID, destination}, strings.NewReader(""), &stdout, &stderr, commandDependencies{
		configuration: newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), gateway.URL),
		credentials:   newMemoryCredentialStore(),
		httpClient:    http.DefaultClient,
		oauth:         fakeOAuthClient{},
	})
	if exitCode != 0 {
		t.Fatalf("file download exit code = %d; stderr = %q", exitCode, stderr.String())
	}
	if stdout.Len() != 0 || stderr.Len() != 0 {
		t.Fatalf("output = stdout %q stderr %q, want empty", stdout.String(), stderr.String())
	}
	contents, err := os.ReadFile(destination)
	if err != nil {
		t.Fatalf("read destination: %v", err)
	}
	if got := string(contents); got != payload {
		t.Fatalf("destination = %q, want %q", got, payload)
	}
}

func TestFileUploadCleansUpAllocatedInputFileAfterStorageFailure(t *testing.T) {
	const inputFileID = "8a1b1c1d-1e1f-4011-8011-121314151617"
	storage := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusBadGateway)
		_, _ = io.WriteString(writer, "Authorization: Bearer storage-secret")
	}))
	defer storage.Close()
	deleted := false
	gateway := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodPost:
			writer.Header().Set("Content-Type", "application/json")
			writer.WriteHeader(http.StatusCreated)
			_, _ = io.WriteString(writer, `{"id":"`+inputFileID+`","upload_url":"`+storage.URL+`/object","expires_at":"2026-08-17T00:00:00Z"}`)
		case request.Method == http.MethodDelete && request.URL.Path == "/v1/input-files/"+inputFileID:
			deleted = true
			writer.WriteHeader(http.StatusNoContent)
		default:
			t.Fatalf("unexpected gateway request %s %s", request.Method, request.URL.Path)
		}
	}))
	defer gateway.Close()
	path := filepath.Join(t.TempDir(), "source.pdb")
	if err := os.WriteFile(path, []byte("payload"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TASKOME_API_KEY", "taskome_ci-key")
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	exitCode := executeWith(context.Background(), []string{"file", "upload", path}, strings.NewReader(""), &stdout, &stderr, commandDependencies{
		configuration: newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), gateway.URL), credentials: newMemoryCredentialStore(), httpClient: http.DefaultClient, oauth: fakeOAuthClient{},
	})
	if exitCode != 2 || !deleted {
		t.Fatalf("exit code = %d, deleted = %t; stderr = %q", exitCode, deleted, stderr.String())
	}
	if stdout.Len() != 0 {
		t.Fatalf("stdout = %q, want no allocated id", stdout.String())
	}
	if strings.Contains(stderr.String(), "storage-secret") {
		t.Fatalf("stderr leaked storage credentials: %q", stderr.String())
	}
}

func TestFileDownloadRetriesTransientStorageFailureAndAtomicallyReplacesDestination(t *testing.T) {
	const inputFileID = "8a1b1c1d-1e1f-4011-8011-121314151617"
	attempts := 0
	storage := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		attempts++
		if attempts == 1 {
			writer.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		_, _ = io.WriteString(writer, "complete bytes")
	}))
	defer storage.Close()
	gateway := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"download_url":"`+storage.URL+`/object","expires_at":"2026-08-17T00:00:00Z"}`)
	}))
	defer gateway.Close()
	destination := filepath.Join(t.TempDir(), "downloaded.pdb")
	if err := os.WriteFile(destination, []byte("old bytes"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TASKOME_API_KEY", "taskome_ci-key")
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	exitCode := executeWith(context.Background(), []string{"file", "download", inputFileID, destination, "--force"}, strings.NewReader(""), &stdout, &stderr, commandDependencies{
		configuration: newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), gateway.URL), credentials: newMemoryCredentialStore(), httpClient: http.DefaultClient, oauth: fakeOAuthClient{},
	})
	if exitCode != 0 || attempts != 2 {
		t.Fatalf("exit code = %d, storage attempts = %d; stderr = %q", exitCode, attempts, stderr.String())
	}
	contents, err := os.ReadFile(destination)
	if err != nil || string(contents) != "complete bytes" {
		t.Fatalf("destination = %q, %v", contents, err)
	}
}
