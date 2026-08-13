import { createTestAuth } from "@taskome/auth/test";
import { base32 } from "@better-auth/utils/base32";
import { createLocalJWKSet, jwtVerify } from "jose";
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

type TestAuth = ReturnType<typeof createTestAuth>;

const authState = vi.hoisted(() => ({ auth: null as TestAuth | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ error: vi.fn(), info: vi.fn() }) },
}));

vi.mock("@/lib/request-context", () => ({
  withRequestId: (_requestId: string, operation: () => Promise<Response>) => operation(),
}));

vi.mock("@taskome/auth", async () => {
  const { createTestAuth: createMockAuth } = await import("@taskome/auth/test");
  const auth = createMockAuth();
  authState.auth = auth;
  return { auth };
});

const { GET } = await import("./route");
const { POST } = await import("./route");
const { GET: GETOAuthMetadata } =
  await import("../../../.well-known/oauth-authorization-server/api/auth/route");
const { GET: GETOpenIDMetadata } = await import("../.well-known/openid-configuration/route");

const baseURL = "http://localhost:3000";
const gatewayRESTAudience = "http://localhost:8000/v1";
const gatewayMCPAudience = "http://localhost:8000/mcp";
const oauthIssuer = `${baseURL}/api/auth`;

function authHeaders(headers: Headers) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("origin", baseURL);
  return requestHeaders;
}

async function authenticatedUser(email: string, name: string) {
  const auth = authState.auth;
  if (!auth) throw new Error("test auth was not initialized");
  const context = await auth.$context;
  const user = await context.test.saveUser(context.test.createUser({ email, name }));
  const { headers } = await context.test.login({ userId: user.id });
  return {
    context,
    headers,
    sessionHeaders: new Headers({
      ...Object.fromEntries(authHeaders(headers)),
      "content-type": "application/json",
    }),
  };
}

describe("/api/auth", () => {
  it("creates multiple named Personal API Keys and never lists their secrets", async () => {
    const { context, headers } = await authenticatedUser(
      "automation@example.com",
      "Automation User",
    );

    const createKey = (name: string) =>
      POST(
        new Request(`${baseURL}/api/auth/api-key/create`, {
          body: JSON.stringify({ name }),
          headers: new Headers({
            ...Object.fromEntries(authHeaders(headers)),
            "content-type": "application/json",
          }),
          method: "POST",
        }),
      );

    const workstationResponse = await createKey("Workstation");
    const clusterResponse = await createKey("Cluster submitter");
    expect(workstationResponse.status).toBe(200);
    expect(clusterResponse.status).toBe(200);

    const workstation = await workstationResponse.json();
    const cluster = await clusterResponse.json();
    expect(workstation).toMatchObject({
      enabled: true,
      expiresAt: null,
      name: "Workstation",
      permissions: null,
      prefix: "taskome_",
      rateLimitEnabled: false,
    });
    expect(cluster.name).toBe("Cluster submitter");
    expect(workstation.key).toMatch(/^taskome_/);
    expect(cluster.key).toMatch(/^taskome_/);
    expect(cluster.key).not.toBe(workstation.key);
    const storedKeys = await context.adapter.findMany<{ key: string }>({ model: "apikey" });
    expect(storedKeys.map((key) => key.key)).not.toContain(workstation.key);
    expect(storedKeys.map((key) => key.key)).not.toContain(cluster.key);

    const listResponse = await GET(
      new Request(`${baseURL}/api/auth/api-key/list`, { headers: authHeaders(headers) }),
    );
    expect(listResponse.status).toBe(200);
    const listed = await listResponse.json();
    expect(listed.total).toBe(2);
    expect(listed.apiKeys.map((key: { name: string }) => key.name)).toEqual(
      expect.arrayContaining(["Workstation", "Cluster submitter"]),
    );
    expect(listed.apiKeys.every((key: Record<string, unknown>) => !("key" in key))).toBe(true);
  });

  it("requires a Web session and a name for Personal API Key management", async () => {
    const { sessionHeaders } = await authenticatedUser("key-owner@example.com", "Key Owner");

    const unnamedResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/create`, {
        body: JSON.stringify({}),
        headers: sessionHeaders,
        method: "POST",
      }),
    );
    expect(unnamedResponse.status).toBe(400);

    const whitespaceNameResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/create`, {
        body: JSON.stringify({ name: "   " }),
        headers: sessionHeaders,
        method: "POST",
      }),
    );
    expect(whitespaceNameResponse.status).toBe(400);

    const customPrefixResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/create`, {
        body: JSON.stringify({ name: "Wrong prefix", prefix: "other_" }),
        headers: sessionHeaders,
        method: "POST",
      }),
    );
    expect(customPrefixResponse.status).toBe(400);

    const createdResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/create`, {
        body: JSON.stringify({ name: "Leaked automation" }),
        headers: sessionHeaders,
        method: "POST",
      }),
    );
    const created = await createdResponse.json();
    const apiKeyHeaders = new Headers({
      "content-type": "application/json",
      origin: baseURL,
      "x-api-key": created.key,
    });

    const createWithApiKeyResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/create`, {
        body: JSON.stringify({ name: "Nested key" }),
        headers: apiKeyHeaders,
        method: "POST",
      }),
    );
    const listWithApiKeyResponse = await GET(
      new Request(`${baseURL}/api/auth/api-key/list`, { headers: apiKeyHeaders }),
    );
    expect(createWithApiKeyResponse.status).toBe(401);
    expect(listWithApiKeyResponse.status).toBe(401);
  });

  it("revokes one Personal API Key permanently while preserving its metadata", async () => {
    const { headers, sessionHeaders } = await authenticatedUser(
      "revoke@example.com",
      "Revoke User",
    );

    const createResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/create`, {
        body: JSON.stringify({ name: "Retired workstation" }),
        headers: sessionHeaders,
        method: "POST",
      }),
    );
    const created = await createResponse.json();

    const revokeResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/update`, {
        body: JSON.stringify({ enabled: false, keyId: created.id }),
        headers: sessionHeaders,
        method: "POST",
      }),
    );
    expect(revokeResponse.status).toBe(200);
    expect(await revokeResponse.json()).toMatchObject({
      enabled: false,
      id: created.id,
      name: "Retired workstation",
    });

    const reactivateResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/update`, {
        body: JSON.stringify({ enabled: true, keyId: created.id }),
        headers: sessionHeaders,
        method: "POST",
      }),
    );
    expect(reactivateResponse.status).toBe(400);

    const renameResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/update`, {
        body: JSON.stringify({ keyId: created.id, name: "Erased history" }),
        headers: sessionHeaders,
        method: "POST",
      }),
    );
    expect(renameResponse.status).toBe(400);

    const deleteResponse = await POST(
      new Request(`${baseURL}/api/auth/api-key/delete`, {
        body: JSON.stringify({ keyId: created.id }),
        headers: sessionHeaders,
        method: "POST",
      }),
    );
    expect(deleteResponse.status).toBe(400);

    const listResponse = await GET(
      new Request(`${baseURL}/api/auth/api-key/list`, { headers: authHeaders(headers) }),
    );
    const listed = await listResponse.json();
    expect(listed.apiKeys).toContainEqual(
      expect.objectContaining({
        enabled: false,
        id: created.id,
        name: "Retired workstation",
      }),
    );
  });

  it("publishes OAuth and OpenID discovery metadata", async () => {
    const oauthResponse = await GETOAuthMetadata(new Request(baseURL));
    const oauthMetadata = await oauthResponse.json();
    expect(oauthResponse.status).toBe(200);
    expect(oauthMetadata).toMatchObject({
      authorization_endpoint: `${baseURL}/api/auth/oauth2/authorize`,
      jwks_uri: `${baseURL}/api/auth/jwks`,
      token_endpoint: `${baseURL}/api/auth/oauth2/token`,
    });

    const openIDResponse = await GETOpenIDMetadata(new Request(baseURL));
    const openIDMetadata = await openIDResponse.json();
    expect(openIDResponse.status).toBe(200);
    expect(openIDMetadata).toMatchObject({
      issuer: `${baseURL}/api/auth`,
      userinfo_endpoint: `${baseURL}/api/auth/oauth2/userinfo`,
    });
  });

  it("publishes keys that verify a session JWT", async () => {
    const auth = authState.auth;
    if (!auth) throw new Error("test auth was not initialized");
    const context = await auth.$context;
    const user = await context.test.saveUser(
      context.test.createUser({ email: "agent@example.com", name: "Agent" }),
    );
    const { headers } = await context.test.login({ userId: user.id });

    const jwksResponse = await GET(new Request("http://localhost:3000/api/auth/jwks"));
    const tokenResponse = await GET(
      new Request("http://localhost:3000/api/auth/token", { headers }),
    );

    expect(jwksResponse.status).toBe(200);
    expect(jwksResponse.headers.get("x-request-id")).toBeTruthy();
    const jwks = await jwksResponse.json();
    const { token } = await tokenResponse.json();
    const verified = await jwtVerify(token, createLocalJWKSet(jwks), {
      audience: gatewayRESTAudience,
      issuer: "http://localhost:3000",
    });

    expect(verified.payload.sub).toBe(user.id);
  });

  it("completes an OAuth authorization-code flow after user consent", async () => {
    const auth = authState.auth;
    if (!auth) throw new Error("test auth was not initialized");
    const context = await auth.$context;
    const user = await context.test.saveUser(
      context.test.createUser({ email: `oauth-${randomUUID()}@example.com`, name: "OAuth User" }),
    );
    const { headers } = await context.test.login({ userId: user.id });
    const client = await auth.api.createOAuthClient({
      body: {
        grant_types: ["authorization_code"],
        redirect_uris: ["http://localhost:4000/callback"],
        response_types: ["code"],
        scope: "taskome",
        token_endpoint_auth_method: "none",
        type: "native",
      },
      headers,
    });
    const codeVerifier = "verifier-for-taskome-test-1234567890";
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const authorizationQuery = new URLSearchParams({
      client_id: client.client_id,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      redirect_uri: "http://localhost:4000/callback",
      response_type: "code",
      scope: "taskome",
      state: "state123",
    });

    const authorizationResponse = await GET(
      new Request(`${baseURL}/api/auth/oauth2/authorize?${authorizationQuery}`, {
        headers: authHeaders(headers),
      }),
    );
    expect(authorizationResponse.status).toBe(302);
    const consentURL = new URL(authorizationResponse.headers.get("location") ?? baseURL, baseURL);
    expect(consentURL.pathname).toBe("/oauth/consent");

    const consentResponse = await POST(
      new Request(`${baseURL}/api/auth/oauth2/consent`, {
        body: JSON.stringify({
          accept: true,
          oauth_query: consentURL.search.slice(1),
          scope: "taskome",
        }),
        headers: new Headers({
          ...Object.fromEntries(authHeaders(headers)),
          "content-type": "application/json",
        }),
        method: "POST",
      }),
    );
    expect(consentResponse.status).toBe(200);
    const consentResult = await consentResponse.json();
    const callbackURL = new URL(consentResult.url);
    expect(callbackURL.searchParams.get("state")).toBe("state123");
    const authorizationCode = callbackURL.searchParams.get("code");
    expect(authorizationCode).toBeTruthy();

    const tokenResponse = await POST(
      new Request(`${baseURL}/api/auth/oauth2/token`, {
        body: new URLSearchParams({
          client_id: client.client_id,
          code: authorizationCode ?? "",
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: "http://localhost:4000/callback",
        }),
        headers: new Headers({
          origin: baseURL,
          "content-type": "application/x-www-form-urlencoded",
        }),
        method: "POST",
      }),
    );
    expect(tokenResponse.status).toBe(200);
    const token = await tokenResponse.json();
    expect(token).toMatchObject({ scope: "taskome", token_type: "Bearer" });
    const jwksResponse = await GET(new Request(`${baseURL}/api/auth/jwks`));
    const verified = await jwtVerify(
      token.access_token,
      createLocalJWKSet(await jwksResponse.json()),
      { audience: gatewayMCPAudience, issuer: oauthIssuer },
    );
    expect(verified.payload.sub).toBe(user.id);
  });

  it("enables TOTP, gates password sign-in, and accepts a backup code", async () => {
    const auth = authState.auth;
    if (!auth) throw new Error("test auth was not initialized");
    const context = await auth.$context;
    const email = `two-factor-${randomUUID()}@example.com`;
    const password = "password123";
    const signUpResponse = await POST(
      new Request(`${baseURL}/api/auth/sign-up/email`, {
        body: JSON.stringify({ email, name: "Two Factor User", password }),
        headers: new Headers({ origin: baseURL, "content-type": "application/json" }),
        method: "POST",
      }),
    );
    expect(signUpResponse.status).toBe(200);
    const signedUpUser = (await signUpResponse.json()).user;
    const { headers } = await context.test.login({ userId: signedUpUser.id });

    const enableResponse = await POST(
      new Request(`${baseURL}/api/auth/two-factor/enable`, {
        body: JSON.stringify({ password }),
        headers: new Headers({
          ...Object.fromEntries(authHeaders(headers)),
          "content-type": "application/json",
        }),
        method: "POST",
      }),
    );
    expect(enableResponse.status).toBe(200);
    const setup = await enableResponse.json();
    expect(setup.totpURI).toMatch(/^otpauth:\/\/totp\//);
    expect(setup.backupCodes).toHaveLength(10);

    const encodedSecret = new URL(setup.totpURI).searchParams.get("secret");
    if (!encodedSecret) throw new Error("two-factor setup did not return a TOTP secret");
    const secret = new TextDecoder().decode(base32.decode(encodedSecret));
    const totp = await auth.api.generateTOTP({ body: { secret } });
    const verifySetupResponse = await POST(
      new Request(`${baseURL}/api/auth/two-factor/verify-totp`, {
        body: JSON.stringify({ code: totp.code }),
        headers: new Headers({
          ...Object.fromEntries(authHeaders(headers)),
          "content-type": "application/json",
        }),
        method: "POST",
      }),
    );
    expect(verifySetupResponse.status).toBe(200);

    const signInResponse = await POST(
      new Request(`${baseURL}/api/auth/sign-in/email`, {
        body: JSON.stringify({ email, password }),
        headers: new Headers({ origin: baseURL, "content-type": "application/json" }),
        method: "POST",
      }),
    );
    expect(signInResponse.status).toBe(200);
    expect(await signInResponse.json()).toMatchObject({
      twoFactorMethods: ["totp"],
      twoFactorRedirect: true,
    });
    const challengeCookie = signInResponse.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("better-auth.two_factor="))
      ?.split(";", 1)[0];
    expect(challengeCookie).toBeDefined();

    const verifySignInResponse = await POST(
      new Request(`${baseURL}/api/auth/two-factor/verify-backup-code`, {
        body: JSON.stringify({ code: setup.backupCodes[0] }),
        headers: new Headers({
          cookie: challengeCookie ?? "",
          origin: baseURL,
          "content-type": "application/json",
        }),
        method: "POST",
      }),
    );
    expect(verifySignInResponse.status).toBe(200);
    expect((await verifySignInResponse.json()).user.id).toBe(signedUpUser.id);
    expect(verifySignInResponse.headers.get("set-cookie")).toContain("better-auth.session_token");
  });
});
