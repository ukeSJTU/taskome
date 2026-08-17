package cli

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

const taskomeCLIClientID = "taskome-cli"

var errBrowserUnavailable = errors.New("unable to open system browser")

type oauthClient interface {
	login(context.Context, string) (oauthTokens, error)
	revoke(context.Context, string, oauthTokens) error
}

type browserOAuthClient struct {
	httpClient  *http.Client
	openBrowser func(context.Context, string) error
}

type protectedResourceMetadata struct {
	AuthorizationServers []string `json:"authorization_servers"`
}

type authorizationServerMetadata struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	RevocationEndpoint    string `json:"revocation_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func defaultOAuthClient() oauthClient {
	return browserOAuthClient{
		httpClient:  &http.Client{Timeout: 10 * time.Second},
		openBrowser: openSystemBrowser,
	}
}

func (client browserOAuthClient) login(ctx context.Context, gatewayURL string) (oauthTokens, error) {
	metadata, err := client.discover(ctx, gatewayURL)
	if err != nil {
		return oauthTokens{}, err
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return oauthTokens{}, fmt.Errorf("start loopback callback listener: %w", err)
	}
	defer func() { _ = listener.Close() }()

	state, err := randomURLSafeValue()
	if err != nil {
		return oauthTokens{}, err
	}
	verifier, err := randomURLSafeValue()
	if err != nil {
		return oauthTokens{}, err
	}
	hasher := sha256.New()
	_, _ = hasher.Write([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(hasher.Sum(nil))
	redirectURL := "http://" + listener.Addr().String() + "/callback"
	callback := make(chan callbackResult, 1)
	server := &http.Server{
		Handler: http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.URL.Path != "/callback" {
				http.NotFound(writer, request)
				return
			}
			if subtle.ConstantTimeCompare([]byte(request.URL.Query().Get("state")), []byte(state)) != 1 {
				callback <- callbackResult{err: errors.New("OAuth callback state did not match")}
				http.Error(writer, "Authentication could not be completed.", http.StatusBadRequest)
				return
			}
			if oauthError := request.URL.Query().Get("error"); oauthError != "" {
				callback <- callbackResult{err: fmt.Errorf("OAuth authorization failed: %s", oauthError)}
				http.Error(writer, "Authentication was not approved.", http.StatusBadRequest)
				return
			}
			code := request.URL.Query().Get("code")
			if code == "" {
				callback <- callbackResult{err: errors.New("OAuth callback did not include an authorization code")}
				http.Error(writer, "Authentication could not be completed.", http.StatusBadRequest)
				return
			}
			callback <- callbackResult{code: code}
			_, _ = io.WriteString(writer, "Taskome login complete. You can return to your terminal.")
		}),
	}
	go func() { _ = server.Serve(listener) }()
	defer func() { _ = server.Shutdown(context.Background()) }()

	authorizationURL, err := url.Parse(metadata.AuthorizationEndpoint)
	if err != nil {
		return oauthTokens{}, fmt.Errorf("parse OAuth authorization endpoint: %w", err)
	}
	query := authorizationURL.Query()
	query.Set("client_id", taskomeCLIClientID)
	query.Set("code_challenge", challenge)
	query.Set("code_challenge_method", "S256")
	query.Set("redirect_uri", redirectURL)
	query.Set("response_type", "code")
	query.Set("scope", "openid profile email offline_access taskome")
	query.Set("state", state)
	authorizationURL.RawQuery = query.Encode()
	if err := client.openBrowser(ctx, authorizationURL.String()); err != nil {
		return oauthTokens{}, fmt.Errorf("%w: %v", errBrowserUnavailable, err)
	}

	waitContext, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	select {
	case result := <-callback:
		if result.err != nil {
			return oauthTokens{}, result.err
		}
		return client.exchange(waitContext, metadata.TokenEndpoint, redirectURL, result.code, verifier)
	case <-waitContext.Done():
		return oauthTokens{}, fmt.Errorf("wait for OAuth browser callback: %w", waitContext.Err())
	}
}

func (client browserOAuthClient) revoke(ctx context.Context, gatewayURL string, tokens oauthTokens) error {
	metadata, err := client.discover(ctx, gatewayURL)
	if err != nil || metadata.RevocationEndpoint == "" || tokens.RefreshToken == "" {
		return err
	}
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		metadata.RevocationEndpoint,
		strings.NewReader(url.Values{"client_id": {taskomeCLIClientID}, "token": {tokens.RefreshToken}}.Encode()),
	)
	if err != nil {
		return fmt.Errorf("create OAuth revocation request: %w", err)
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := client.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("revoke OAuth refresh token: %w", err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("revoke OAuth refresh token: authorization server returned %s", response.Status)
	}
	return nil
}

func (client browserOAuthClient) discover(
	ctx context.Context,
	gatewayURL string,
) (authorizationServerMetadata, error) {
	resourceURL, err := url.Parse(gatewayURL + "/.well-known/oauth-protected-resource/v1")
	if err != nil {
		return authorizationServerMetadata{}, fmt.Errorf("parse protected-resource metadata URL: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, resourceURL.String(), nil)
	if err != nil {
		return authorizationServerMetadata{}, fmt.Errorf("create protected-resource metadata request: %w", err)
	}
	var protectedResource protectedResourceMetadata
	if err := client.getJSON(request, &protectedResource); err != nil {
		return authorizationServerMetadata{}, fmt.Errorf("discover OAuth authorization server: %w", err)
	}
	if len(protectedResource.AuthorizationServers) != 1 {
		return authorizationServerMetadata{}, errors.New("protected resource did not publish one authorization server")
	}
	authorizationServer, err := url.Parse(protectedResource.AuthorizationServers[0])
	if err != nil {
		return authorizationServerMetadata{}, fmt.Errorf("parse OAuth authorization server URL: %w", err)
	}
	metadataURL := authorizationServer.ResolveReference(&url.URL{
		Path: "/.well-known/oauth-authorization-server" + authorizationServer.Path,
	})
	request, err = http.NewRequestWithContext(ctx, http.MethodGet, metadataURL.String(), nil)
	if err != nil {
		return authorizationServerMetadata{}, fmt.Errorf("create authorization-server metadata request: %w", err)
	}
	var metadata authorizationServerMetadata
	if err := client.getJSON(request, &metadata); err != nil {
		return authorizationServerMetadata{}, fmt.Errorf("load authorization-server metadata: %w", err)
	}
	if metadata.AuthorizationEndpoint == "" || metadata.TokenEndpoint == "" {
		return authorizationServerMetadata{}, errors.New("authorization-server metadata is incomplete")
	}
	return metadata, nil
}

func (client browserOAuthClient) exchange(
	ctx context.Context,
	tokenEndpoint, redirectURL, code, verifier string,
) (oauthTokens, error) {
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		tokenEndpoint,
		strings.NewReader(url.Values{
			"client_id":     {taskomeCLIClientID},
			"code":          {code},
			"code_verifier": {verifier},
			"grant_type":    {"authorization_code"},
			"redirect_uri":  {redirectURL},
		}.Encode()),
	)
	if err != nil {
		return oauthTokens{}, fmt.Errorf("create OAuth token request: %w", err)
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var token tokenResponse
	if err := client.getJSON(request, &token); err != nil {
		return oauthTokens{}, fmt.Errorf("exchange OAuth authorization code: %w", err)
	}
	if token.AccessToken == "" || token.RefreshToken == "" {
		return oauthTokens{}, errors.New("OAuth token response did not include access and refresh tokens")
	}
	return oauthTokens(token), nil
}

func (client browserOAuthClient) getJSON(request *http.Request, destination any) error {
	response, err := client.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("received %s", response.Status)
	}
	if err := json.NewDecoder(response.Body).Decode(destination); err != nil {
		return fmt.Errorf("decode JSON response: %w", err)
	}
	return nil
}

type callbackResult struct {
	code string
	err  error
}

func randomURLSafeValue() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate OAuth value: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func openSystemBrowser(ctx context.Context, value string) error {
	var command *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		command = exec.CommandContext(ctx, "open", value)
	case "windows":
		command = exec.CommandContext(ctx, "rundll32", "url.dll,FileProtocolHandler", value)
	default:
		command = exec.CommandContext(ctx, "xdg-open", value)
	}
	return command.Start()
}
