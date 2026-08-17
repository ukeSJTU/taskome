package cli

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func TestBrowserOAuthLoginDiscoversMetadataAndUsesPKCE(t *testing.T) {
	t.Parallel()

	var authorizationQuery url.Values
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/.well-known/oauth-protected-resource/v1":
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"authorization_servers": []string{serverURL(request)},
			})
		case "/.well-known/oauth-authorization-server":
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"authorization_endpoint": serverURL(request) + "/authorize",
				"token_endpoint":         serverURL(request) + "/token",
			})
		case "/token":
			if err := request.ParseForm(); err != nil {
				t.Fatalf("ParseForm() error = %v", err)
			}
			if got := request.Form.Get("client_id"); got != taskomeCLIClientID {
				t.Fatalf("client_id = %q, want %q", got, taskomeCLIClientID)
			}
			if got := request.Form.Get("code_verifier"); got == "" {
				t.Fatal("token request has no code_verifier")
			} else {
				hash := sha256.Sum256([]byte(got))
				want := base64.RawURLEncoding.EncodeToString(hash[:])
				if authorizationQuery.Get("code_challenge") != want {
					t.Fatalf("code_challenge = %q, want derived S256 value", authorizationQuery.Get("code_challenge"))
				}
			}
			_ = json.NewEncoder(writer).Encode(tokenResponse{AccessToken: "access", ExpiresIn: 3600, RefreshToken: "refresh"})
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	client := browserOAuthClient{
		httpClient: server.Client(),
		openBrowser: func(_ context.Context, value string) error {
			authorizationURL, err := url.Parse(value)
			if err != nil {
				return err
			}
			authorizationQuery = authorizationURL.Query()
			if authorizationQuery.Get("code_challenge_method") != "S256" {
				t.Fatalf("code_challenge_method = %q, want S256", authorizationQuery.Get("code_challenge_method"))
			}
			callbackURL, err := url.Parse(authorizationQuery.Get("redirect_uri"))
			if err != nil {
				return err
			}
			callbackQuery := callbackURL.Query()
			callbackQuery.Set("code", "authorization-code")
			callbackQuery.Set("state", authorizationQuery.Get("state"))
			callbackURL.RawQuery = callbackQuery.Encode()
			response, err := http.Get(callbackURL.String()) // #nosec G107 -- test callback URL comes from the loopback listener.
			if err == nil {
				_ = response.Body.Close()
			}
			return err
		},
	}

	tokens, err := client.login(context.Background(), server.URL)
	if err != nil {
		t.Fatalf("login() error = %v", err)
	}
	if tokens.AccessToken != "access" || tokens.RefreshToken != "refresh" || tokens.AccessTokenExpiresAt.Before(time.Now()) {
		t.Fatalf("tokens = %#v", tokens)
	}
}

func TestBrowserOAuthRevokeUsesAuthorizationServerMetadata(t *testing.T) {
	var revokedToken string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/.well-known/oauth-protected-resource/v1":
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"authorization_servers": []string{serverURL(request)},
			})
		case "/.well-known/oauth-authorization-server":
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"authorization_endpoint": serverURL(request) + "/authorize",
				"revocation_endpoint":    serverURL(request) + "/revoke",
				"token_endpoint":         serverURL(request) + "/token",
			})
		case "/revoke":
			if err := request.ParseForm(); err != nil {
				t.Fatalf("ParseForm() error = %v", err)
			}
			if got := request.Form.Get("client_id"); got != taskomeCLIClientID {
				t.Fatalf("client_id = %q, want %q", got, taskomeCLIClientID)
			}
			revokedToken = request.Form.Get("token")
			writer.WriteHeader(http.StatusOK)
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	client := browserOAuthClient{httpClient: server.Client()}
	if err := client.revoke(context.Background(), server.URL, oauthTokens{RefreshToken: "refresh-token"}); err != nil {
		t.Fatalf("revoke() error = %v", err)
	}
	if revokedToken != "refresh-token" {
		t.Fatalf("revoked token = %q, want refresh-token", revokedToken)
	}
}

func TestBrowserOAuthRefreshRotatesCredentials(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/.well-known/oauth-protected-resource/v1":
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"authorization_servers": []string{serverURL(request)},
			})
		case "/.well-known/oauth-authorization-server":
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"authorization_endpoint": serverURL(request) + "/authorize",
				"token_endpoint":         serverURL(request) + "/token",
			})
		case "/token":
			if err := request.ParseForm(); err != nil {
				t.Fatalf("ParseForm() error = %v", err)
			}
			if got := request.Form.Get("grant_type"); got != "refresh_token" {
				t.Fatalf("grant_type = %q, want refresh_token", got)
			}
			if got := request.Form.Get("refresh_token"); got != "old-refresh-token" {
				t.Fatalf("refresh_token = %q, want old-refresh-token", got)
			}
			_ = json.NewEncoder(writer).Encode(tokenResponse{
				AccessToken: "refreshed-access-token", ExpiresIn: 3600, RefreshToken: "new-refresh-token",
			})
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	client := browserOAuthClient{httpClient: server.Client()}
	tokens, err := client.refresh(context.Background(), server.URL, oauthTokens{RefreshToken: "old-refresh-token"})
	if err != nil {
		t.Fatalf("refresh() error = %v", err)
	}
	if tokens.AccessToken != "refreshed-access-token" || tokens.RefreshToken != "new-refresh-token" || tokens.AccessTokenExpiresAt.Before(time.Now()) {
		t.Fatalf("tokens = %#v", tokens)
	}
}

func serverURL(request *http.Request) string {
	return "http://" + request.Host
}
