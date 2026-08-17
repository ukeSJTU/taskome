package cli

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestConfigCommandsReadAndWriteGatewayURL(t *testing.T) {
	t.Parallel()

	configuration := newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), "https://api.example.com")
	dependencies := commandDependencies{
		configuration: configuration,
		credentials:   newMemoryCredentialStore(),
	}
	var stdout bytes.Buffer
	var stderr bytes.Buffer

	if exitCode := executeWith(
		context.Background(),
		[]string{"config", "get", "gateway-url"},
		strings.NewReader(""),
		&stdout,
		&stderr,
		dependencies,
	); exitCode != 0 {
		t.Fatalf("config get exit code = %d, want 0; stderr = %q", exitCode, stderr.String())
	}
	if got := stdout.String(); got != "https://api.example.com\n" {
		t.Fatalf("config get output = %q", got)
	}

	stdout.Reset()
	stderr.Reset()
	if exitCode := executeWith(
		context.Background(),
		[]string{"config", "set", "gateway-url", "http://127.0.0.1:8000"},
		strings.NewReader(""),
		&stdout,
		&stderr,
		dependencies,
	); exitCode != 0 {
		t.Fatalf("config set exit code = %d, want 0; stderr = %q", exitCode, stderr.String())
	}
	if got := stdout.String(); got != "gateway_url updated\n" {
		t.Fatalf("config set output = %q", got)
	}
	if got, err := configuration.gatewayURL(); err != nil || got != "http://127.0.0.1:8000" {
		t.Fatalf("gateway URL = %q, %v", got, err)
	}
}

func TestLoginWithAPIKeyAndLogoutOnlyChangeLocalCredential(t *testing.T) {
	t.Parallel()

	configuration := newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), "http://127.0.0.1:8000")
	credentials := newMemoryCredentialStore()
	dependencies := commandDependencies{configuration: configuration, credentials: credentials}
	var stdout bytes.Buffer
	var stderr bytes.Buffer

	if exitCode := executeWith(
		context.Background(),
		[]string{"login", "--api-key"},
		strings.NewReader("taskome_local-key\n"),
		&stdout,
		&stderr,
		dependencies,
	); exitCode != 0 {
		t.Fatalf("login --api-key exit code = %d, want 0; stderr = %q", exitCode, stderr.String())
	}
	if got := stdout.String(); got != "Personal API Key saved for automation.\n" {
		t.Fatalf("login output = %q", got)
	}
	if got, err := credentials.getPersonalAPIKey("http://127.0.0.1:8000"); err != nil || got != "taskome_local-key" {
		t.Fatalf("saved API key = %q, %v", got, err)
	}

	stdout.Reset()
	stderr.Reset()
	if exitCode := executeWith(
		context.Background(),
		[]string{"logout"},
		strings.NewReader(""),
		&stdout,
		&stderr,
		dependencies,
	); exitCode != 0 {
		t.Fatalf("logout exit code = %d, want 0; stderr = %q", exitCode, stderr.String())
	}
	if got := stdout.String(); got != "Removed local Personal API Key.\n" {
		t.Fatalf("logout output = %q", got)
	}
	if _, err := credentials.getPersonalAPIKey("http://127.0.0.1:8000"); err != errCredentialNotFound {
		t.Fatalf("API key after logout error = %v, want errCredentialNotFound", err)
	}
}

func TestEnvironmentAPIKeyTakesPrecedenceOverStoredOAuthCredentials(t *testing.T) {
	t.Parallel()

	credentials := newMemoryCredentialStore()
	if err := credentials.setOAuthTokens("https://api.example.com", oauthTokens{AccessToken: "access"}); err != nil {
		t.Fatalf("set OAuth tokens: %v", err)
	}

	authentication, err := resolveGatewayAuthentication(
		context.Background(),
		credentials,
		fakeOAuthClient{},
		"https://api.example.com",
		"taskome_ci-key",
	)
	if err != nil {
		t.Fatalf("resolveGatewayAuthentication() error = %v", err)
	}
	if authentication.personalAPIKey != "taskome_ci-key" || authentication.accessToken != "" {
		t.Fatalf("authentication = %#v, want environment API key", authentication)
	}
}

func TestInteractiveLoginStoresOAuthCredentials(t *testing.T) {
	t.Parallel()

	configuration := newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), "https://api.example.com")
	credentials := newMemoryCredentialStore()
	dependencies := commandDependencies{
		configuration: configuration,
		credentials:   credentials,
		oauth:         fakeOAuthClient{tokens: oauthTokens{AccessToken: "access", RefreshToken: "refresh"}},
	}
	var stdout bytes.Buffer
	var stderr bytes.Buffer

	exitCode := executeWith(
		context.Background(), []string{"login"}, strings.NewReader(""), &stdout, &stderr, dependencies,
	)
	if exitCode != 0 {
		t.Fatalf("login exit code = %d, want 0; stderr = %q", exitCode, stderr.String())
	}
	if got := stdout.String(); got != "Signed in to Taskome.\n" {
		t.Fatalf("login output = %q", got)
	}
	if got, err := credentials.getOAuthTokens("https://api.example.com"); err != nil || got.RefreshToken != "refresh" {
		t.Fatalf("saved OAuth tokens = %#v, %v", got, err)
	}
}

func TestInteractiveLoginExplainsAPIKeyFallbackWhenBrowserCannotOpen(t *testing.T) {
	t.Parallel()

	dependencies := commandDependencies{
		configuration: newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), "https://api.example.com"),
		credentials:   newMemoryCredentialStore(),
		oauth:         fakeOAuthClient{err: errBrowserUnavailable},
	}
	var stdout bytes.Buffer
	var stderr bytes.Buffer

	exitCode := executeWith(
		context.Background(), []string{"login"}, strings.NewReader(""), &stdout, &stderr, dependencies,
	)
	if exitCode != 2 {
		t.Fatalf("login exit code = %d, want 2", exitCode)
	}
	if !strings.Contains(stderr.String(), "taskome login --api-key") {
		t.Fatalf("stderr = %q, want API-key fallback", stderr.String())
	}
}

func TestWhoAmIUsesEnvironmentAPIKeyOverStoredOAuthCredentials(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("X-API-Key"); got != "taskome_ci-key" {
			t.Fatalf("X-API-Key = %q, want TASKOME_API_KEY", got)
		}
		if got := request.Header.Get("Authorization"); got != "" {
			t.Fatalf("Authorization = %q, want empty", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"user_id":"user-1","credential_kind":"personal_api_key"}`)
	}))
	defer server.Close()
	t.Setenv("TASKOME_API_KEY", "taskome_ci-key")

	configuration := newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), server.URL)
	credentials := newMemoryCredentialStore()
	if err := credentials.setOAuthTokens(server.URL, oauthTokens{AccessToken: "stored-access"}); err != nil {
		t.Fatalf("set OAuth tokens: %v", err)
	}
	var stdout bytes.Buffer
	var stderr bytes.Buffer

	exitCode := executeWith(
		context.Background(),
		[]string{"whoami"},
		strings.NewReader(""),
		&stdout,
		&stderr,
		commandDependencies{
			configuration: configuration,
			credentials:   credentials,
			httpClient:    server.Client(),
			oauth:         fakeOAuthClient{},
		},
	)
	if exitCode != 0 {
		t.Fatalf("whoami exit code = %d, want 0; stderr = %q", exitCode, stderr.String())
	}
	if got := stdout.String(); got != "user-1 (personal_api_key)\n" {
		t.Fatalf("whoami output = %q", got)
	}
}

func TestWhoAmIRefreshesExpiredOAuthCredentials(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("Authorization"); got != "Bearer refreshed-access" {
			t.Fatalf("Authorization = %q, want refreshed OAuth access token", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"user_id":"user-1","credential_kind":"oauth"}`)
	}))
	defer server.Close()

	configuration := newConfiguration(filepath.Join(t.TempDir(), "config.yaml"), server.URL)
	credentials := newMemoryCredentialStore()
	if err := credentials.setOAuthTokens(server.URL, oauthTokens{
		AccessToken:          "expired-access",
		AccessTokenExpiresAt: time.Now().Add(-time.Minute),
		RefreshToken:         "old-refresh",
	}); err != nil {
		t.Fatalf("set OAuth tokens: %v", err)
	}
	var stdout bytes.Buffer
	var stderr bytes.Buffer

	exitCode := executeWith(
		context.Background(),
		[]string{"whoami"},
		strings.NewReader(""),
		&stdout,
		&stderr,
		commandDependencies{
			configuration: configuration,
			credentials:   credentials,
			httpClient:    server.Client(),
			oauth: fakeOAuthClient{refreshed: oauthTokens{
				AccessToken:          "refreshed-access",
				AccessTokenExpiresAt: time.Now().Add(time.Hour),
				RefreshToken:         "new-refresh",
			}},
		},
	)
	if exitCode != 0 {
		t.Fatalf("whoami exit code = %d, want 0; stderr = %q", exitCode, stderr.String())
	}
	if got := stdout.String(); got != "user-1 (oauth)\n" {
		t.Fatalf("whoami output = %q", got)
	}
	if tokens, err := credentials.getOAuthTokens(server.URL); err != nil || tokens.RefreshToken != "new-refresh" {
		t.Fatalf("stored refreshed OAuth tokens = %#v, %v", tokens, err)
	}
}

type fakeOAuthClient struct {
	err       error
	refreshed oauthTokens
	tokens    oauthTokens
}

func (client fakeOAuthClient) login(context.Context, string) (oauthTokens, error) {
	return client.tokens, client.err
}

func (client fakeOAuthClient) refresh(context.Context, string, oauthTokens) (oauthTokens, error) {
	return client.refreshed, client.err
}

func (client fakeOAuthClient) revoke(context.Context, string, oauthTokens) error {
	return client.err
}
