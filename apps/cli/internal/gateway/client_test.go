package gateway

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientSendsPersonalAPIKey(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/v1/me" {
			t.Fatalf("path = %q, want /v1/me", request.URL.Path)
		}
		if got := request.Header.Get("X-API-Key"); got != "taskome_test" {
			t.Fatalf("X-API-Key = %q, want configured key", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"user_id":"user-1","credential_kind":"personal_api_key"}`)
	}))
	defer server.Close()

	client, err := NewClient(server.URL, "taskome_test", server.Client())
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}

	response, err := client.GetCurrentIdentityWithResponse(context.Background())
	if err != nil {
		t.Fatalf("GetCurrentIdentityWithResponse() error = %v", err)
	}
	if response.JSON200 == nil || response.JSON200.UserId != "user-1" {
		t.Fatalf("identity = %#v, want user-1", response.JSON200)
	}
}

func TestOAuthClientSendsBearerAccessToken(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/v1/me" {
			t.Fatalf("path = %q, want /v1/me", request.URL.Path)
		}
		if got := request.Header.Get("Authorization"); got != "Bearer taskome_access" {
			t.Fatalf("Authorization = %q, want configured OAuth token", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"user_id":"user-1","credential_kind":"oauth_access_token"}`)
	}))
	defer server.Close()

	client, err := NewOAuthClient(server.URL, "taskome_access", server.Client())
	if err != nil {
		t.Fatalf("NewOAuthClient() error = %v", err)
	}

	response, err := client.GetCurrentIdentityWithResponse(context.Background())
	if err != nil {
		t.Fatalf("GetCurrentIdentityWithResponse() error = %v", err)
	}
	if response.JSON200 == nil || response.JSON200.UserId != "user-1" {
		t.Fatalf("identity = %#v, want user-1", response.JSON200)
	}
}
