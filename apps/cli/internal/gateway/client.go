package gateway

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	generated "github.com/ukeSJTU/taskome/apps/cli/internal/gateway/generated"
)

// NewClient constructs the CLI-owned Gateway boundary for a Personal API Key.
func NewClient(baseURL, personalAPIKey string, httpClient *http.Client) (*generated.ClientWithResponses, error) {
	if strings.TrimSpace(baseURL) == "" {
		return nil, fmt.Errorf("gateway base URL is required")
	}
	if strings.TrimSpace(personalAPIKey) == "" {
		return nil, fmt.Errorf("personal API key is required")
	}

	return generated.NewClientWithResponses(
		baseURL,
		generated.WithHTTPClient(httpClient),
		generated.WithRequestEditorFn(func(_ context.Context, request *http.Request) error {
			request.Header.Set("X-API-Key", personalAPIKey)
			return nil
		}),
	)
}

// NewOAuthClient constructs the CLI-owned Gateway boundary for an OAuth access token.
func NewOAuthClient(baseURL, accessToken string, httpClient *http.Client) (*generated.ClientWithResponses, error) {
	if strings.TrimSpace(baseURL) == "" {
		return nil, fmt.Errorf("gateway base URL is required")
	}
	if strings.TrimSpace(accessToken) == "" {
		return nil, fmt.Errorf("OAuth access token is required")
	}

	return generated.NewClientWithResponses(
		baseURL,
		generated.WithHTTPClient(httpClient),
		generated.WithRequestEditorFn(func(_ context.Context, request *http.Request) error {
			request.Header.Set("Authorization", "Bearer "+accessToken)
			return nil
		}),
	)
}
