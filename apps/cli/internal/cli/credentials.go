package cli

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	keyring "github.com/zalando/go-keyring"
)

var errCredentialNotFound = errors.New("credential not found")

const credentialService = "taskome"

type oauthTokens struct {
	AccessToken          string    `json:"access_token"`
	AccessTokenExpiresAt time.Time `json:"access_token_expires_at"`
	RefreshToken         string    `json:"refresh_token"`
}

type gatewayAuthentication struct {
	accessToken    string
	personalAPIKey string
}

type credentialStore interface {
	getOAuthTokens(gatewayURL string) (oauthTokens, error)
	setOAuthTokens(gatewayURL string, tokens oauthTokens) error
	deleteOAuthTokens(gatewayURL string) error
	getPersonalAPIKey(gatewayURL string) (string, error)
	setPersonalAPIKey(gatewayURL, key string) error
	deletePersonalAPIKey(gatewayURL string) error
}

type keyringCredentialStore struct{}

func defaultCredentialStore() credentialStore {
	return keyringCredentialStore{}
}

func (keyringCredentialStore) getOAuthTokens(gatewayURL string) (oauthTokens, error) {
	value, err := keyring.Get(credentialService, "oauth:"+gatewayURL)
	if errors.Is(err, keyring.ErrNotFound) {
		return oauthTokens{}, errCredentialNotFound
	}
	if err != nil {
		return oauthTokens{}, fmt.Errorf("read OAuth credentials: %w", err)
	}
	var tokens oauthTokens
	if err := json.Unmarshal([]byte(value), &tokens); err != nil {
		return oauthTokens{}, fmt.Errorf("decode OAuth credentials: %w", err)
	}
	return tokens, nil
}

func (keyringCredentialStore) setOAuthTokens(gatewayURL string, tokens oauthTokens) error {
	value, err := json.Marshal(tokens)
	if err != nil {
		return fmt.Errorf("encode OAuth credentials: %w", err)
	}
	if err := keyring.Set(credentialService, "oauth:"+gatewayURL, string(value)); err != nil {
		return fmt.Errorf("store OAuth credentials: %w", err)
	}
	return nil
}

func (keyringCredentialStore) deleteOAuthTokens(gatewayURL string) error {
	return deleteKeyringCredential("oauth:" + gatewayURL)
}

func (keyringCredentialStore) getPersonalAPIKey(gatewayURL string) (string, error) {
	value, err := keyring.Get(credentialService, "api-key:"+gatewayURL)
	if errors.Is(err, keyring.ErrNotFound) {
		return "", errCredentialNotFound
	}
	if err != nil {
		return "", fmt.Errorf("read Personal API Key: %w", err)
	}
	return value, nil
}

func (keyringCredentialStore) setPersonalAPIKey(gatewayURL, key string) error {
	if err := keyring.Set(credentialService, "api-key:"+gatewayURL, key); err != nil {
		return fmt.Errorf("store Personal API Key: %w", err)
	}
	return nil
}

func (keyringCredentialStore) deletePersonalAPIKey(gatewayURL string) error {
	return deleteKeyringCredential("api-key:" + gatewayURL)
}

func deleteKeyringCredential(account string) error {
	err := keyring.Delete(credentialService, account)
	if errors.Is(err, keyring.ErrNotFound) {
		return errCredentialNotFound
	}
	if err != nil {
		return fmt.Errorf("delete credential: %w", err)
	}
	return nil
}

func resolveGatewayAuthentication(
	ctx context.Context,
	credentials credentialStore,
	oauth oauthClient,
	gatewayURL, environmentAPIKey string,
) (gatewayAuthentication, error) {
	if environmentAPIKey != "" {
		return gatewayAuthentication{personalAPIKey: environmentAPIKey}, nil
	}
	if apiKey, err := credentials.getPersonalAPIKey(gatewayURL); err == nil {
		return gatewayAuthentication{personalAPIKey: apiKey}, nil
	} else if !errors.Is(err, errCredentialNotFound) {
		return gatewayAuthentication{}, err
	}
	if tokens, err := credentials.getOAuthTokens(gatewayURL); err == nil {
		if !tokens.AccessTokenExpiresAt.IsZero() && !tokens.AccessTokenExpiresAt.After(time.Now().Add(30*time.Second)) {
			refreshed, refreshErr := oauth.refresh(ctx, gatewayURL, tokens)
			if refreshErr != nil {
				return gatewayAuthentication{}, fmt.Errorf("refresh OAuth credentials: %w; sign in again with taskome login", refreshErr)
			}
			if storeErr := credentials.setOAuthTokens(gatewayURL, refreshed); storeErr != nil {
				return gatewayAuthentication{}, storeErr
			}
			tokens = refreshed
		}
		if tokens.AccessToken == "" {
			return gatewayAuthentication{}, errors.New("stored OAuth credentials did not include an access token")
		}
		return gatewayAuthentication{accessToken: tokens.AccessToken}, nil
	} else if !errors.Is(err, errCredentialNotFound) {
		return gatewayAuthentication{}, err
	}
	return gatewayAuthentication{}, errCredentialNotFound
}

type memoryCredentialStore struct {
	apiKeys map[string]string
	oauth   map[string]oauthTokens
}

func newMemoryCredentialStore() *memoryCredentialStore {
	return &memoryCredentialStore{apiKeys: map[string]string{}, oauth: map[string]oauthTokens{}}
}

func (store *memoryCredentialStore) getOAuthTokens(gatewayURL string) (oauthTokens, error) {
	tokens, ok := store.oauth[gatewayURL]
	if !ok {
		return oauthTokens{}, errCredentialNotFound
	}
	return tokens, nil
}

func (store *memoryCredentialStore) setOAuthTokens(gatewayURL string, tokens oauthTokens) error {
	store.oauth[gatewayURL] = tokens
	return nil
}

func (store *memoryCredentialStore) deleteOAuthTokens(gatewayURL string) error {
	if _, ok := store.oauth[gatewayURL]; !ok {
		return errCredentialNotFound
	}
	delete(store.oauth, gatewayURL)
	return nil
}

func (store *memoryCredentialStore) getPersonalAPIKey(gatewayURL string) (string, error) {
	key, ok := store.apiKeys[gatewayURL]
	if !ok {
		return "", errCredentialNotFound
	}
	return key, nil
}

func (store *memoryCredentialStore) setPersonalAPIKey(gatewayURL, key string) error {
	store.apiKeys[gatewayURL] = key
	return nil
}

func (store *memoryCredentialStore) deletePersonalAPIKey(gatewayURL string) error {
	if _, ok := store.apiKeys[gatewayURL]; !ok {
		return errCredentialNotFound
	}
	delete(store.apiKeys, gatewayURL)
	return nil
}
