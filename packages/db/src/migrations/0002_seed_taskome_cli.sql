INSERT INTO "oauth_client" (
  "id",
  "client_id",
  "created_at",
  "grant_types",
  "name",
  "public",
  "redirect_uris",
  "require_pkce",
  "response_types",
  "scopes",
  "token_endpoint_auth_method",
  "type",
  "updated_at"
) VALUES (
  'taskome-cli',
  'taskome-cli',
  now(),
  ARRAY['authorization_code', 'refresh_token'],
  'Taskome CLI',
  true,
  ARRAY['http://127.0.0.1/callback'],
  true,
  ARRAY['code'],
  ARRAY['openid', 'profile', 'email', 'offline_access', 'taskome'],
  'none',
  'native',
  now()
) ON CONFLICT ("client_id") DO NOTHING;
