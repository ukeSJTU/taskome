import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import { resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createApp, type App } from "@/app";
import { createSessionResolver } from "@/auth/session";
import { createApiKeyResolver } from "@/auth/api-key-resolver";
import { createRestSecurityContextResolver } from "@/auth/security-context";
import { protectedResources } from "@/auth/resources";
import { withAuthRequestCorrelation } from "@/auth/request-correlation";
import { registerNativeOAuthClient } from "@/auth/oauth-client-registration";
import { createTaskomeMcpHandler } from "@/auth/mcp";
import { createOAuthGrantService } from "@/auth/oauth-grants";
import type { DatabaseRuntime } from "@/db/database";
import {
  apikey,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthGrant,
  oauthRefreshToken,
  securityEvent,
} from "@/db/schema";
import { createApiKeyService } from "@/features/api-keys";
import { CreatedApiKeySchema } from "@/features/api-keys/api-key.schemas";
import { createOAuthGrantManagementService } from "@/features/oauth-grants";
import { createProjectsModule } from "@/features/projects";

const serverOrigin = "http://localhost:3000";
const webOrigin = "http://localhost:3001";

async function responseLocation(response: Response) {
  const location = response.headers.get("location");
  if (location) return location;
  const raw = await response.json();
  const body = z
    .object({ redirect_uri: z.string().optional(), url: z.string().optional() })
    .parse(raw);
  const result = body.redirect_uri ?? body.url;
  if (!result) throw new Error(`OAuth response has no redirect location: ${JSON.stringify(raw)}`);
  return result;
}

describe("server with PostgreSQL and Better Auth", () => {
  let app: App;
  let container: StartedPostgreSqlContainer;
  let database: DatabaseRuntime;
  let auth: (typeof import("@/auth.test-instance"))["testAuth"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:18.4-alpine3.24")
      .withDatabase("taskome_test")
      .withPassword("taskome_test")
      .withUsername("taskome_test")
      .start();
    process.env.BETTER_AUTH_SECRET = "integration-test-secret-at-least-32-characters"; // gitleaks:allow
    process.env.BETTER_AUTH_URL = serverOrigin;
    process.env.CORS_ORIGIN = webOrigin;
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.NODE_ENV = "test";

    ({ database } = await import("@/db"));
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    });

    ({ testAuth: auth } = await import("@/auth.test-instance"));
    const getSession = createSessionResolver(auth);
    app = createApp({
      apiKeyService: createApiKeyService(database.db),
      authHandler: (request) => withAuthRequestCorrelation(request, () => auth.handler(request)),
      checkReadiness: database.check,
      corsOrigin: webOrigin,
      drain: () => undefined,
      getSession,
      mcpHandler: createTaskomeMcpHandler(auth, createOAuthGrantService(database.db), serverOrigin),
      oauthGrantService: createOAuthGrantManagementService(database.db),
      projects: createProjectsModule(database.db),
      resolveSecurityContext: createRestSecurityContextResolver({
        getSession,
        resource: protectedResources(serverOrigin).rest,
        verifyApiKey: createApiKeyResolver(auth, database.db),
      }),
    });
  });

  afterAll(async () => {
    await database?.close();
    await container?.stop();
  });

  it("migrates from empty, creates a session, and exposes the current user", async () => {
    const email = "integration@example.com";
    const signUpResponse = await app.request(`${serverOrigin}/api/auth/sign-up/email`, {
      body: JSON.stringify({
        email,
        name: "Integration User",
        password: "correct horse battery staple",
      }),
      headers: {
        "content-type": "application/json",
        origin: webOrigin,
      },
      method: "POST",
    });
    const cookie = signUpResponse.headers.get("set-cookie")?.split(";", 1)[0];

    expect(signUpResponse.status).toBe(200);
    expect(cookie).toBeTruthy();

    const meResponse = await app.request(`${serverOrigin}/api/v1/me`, {
      headers: {
        cookie: cookie ?? "",
        origin: webOrigin,
      },
    });

    expect(meResponse.status).toBe(200);
    expect(await meResponse.json()).toEqual({
      email,
      emailVerified: false,
      id: expect.any(String),
      image: null,
      name: "Integration User",
    });
  });

  it("reports readiness through the migrated database", async () => {
    const response = await app.request("/readyz");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });

  it("creates an API-key secret once, persists only its hash, and revokes immediately", async () => {
    const test = (await auth.$context).test;
    const user = await test.saveUser(
      test.createUser({ email: "api-key@example.com", emailVerified: true }),
    );
    const headers = await test.getAuthHeaders({ userId: user.id });
    headers.set("content-type", "application/json");
    headers.set("origin", webOrigin);

    const createResponse = await app.request(`${serverOrigin}/api/v1/api-keys`, {
      body: JSON.stringify({ name: "automation", scopes: ["taskome:access"] }),
      headers,
      method: "POST",
    });
    const created = CreatedApiKeySchema.parse(await createResponse.json());

    expect(createResponse.status).toBe(201);
    expect(created).toMatchObject({
      name: "automation",
      scopes: ["taskome:access"],
      secret: expect.stringMatching(/^sk-/),
      state: "active",
    });

    const [stored] = await database.db.select().from(apikey).where(eq(apikey.id, created.id));
    const creationEvents = await database.db
      .select()
      .from(securityEvent)
      .where(
        and(
          eq(securityEvent.credentialId, created.id),
          eq(securityEvent.operation, "api_key.created"),
        ),
      );
    expect(stored?.key).not.toBe(created.secret);
    expect(stored?.key).not.toContain(created.secret);
    expect(creationEvents).toHaveLength(1);

    const listResponse = await app.request(`${serverOrigin}/api/v1/api-keys`, { headers });
    const listed = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(JSON.stringify(listed)).not.toContain(created.secret);
    expect(JSON.stringify(listed)).not.toContain(stored?.key);

    const validBefore = await auth.api.verifyApiKey({ body: { key: created.secret } });
    expect(validBefore.valid).toBe(true);
    const authorizedResponse = await app.request(`${serverOrigin}/api/v1/me`, {
      headers: { authorization: `Bearer ${created.secret}` },
    });
    expect(authorizedResponse.status).toBe(200);
    expect(await authorizedResponse.json()).toMatchObject({ email: user.email, id: user.id });

    const revokeResponse = await app.request(`${serverOrigin}/api/v1/api-keys/${created.id}`, {
      headers,
      method: "DELETE",
    });
    expect(revokeResponse.status).toBe(204);
    const validAfter = await auth.api.verifyApiKey({ body: { key: created.secret } });
    expect(validAfter.valid).toBe(false);
    const deniedResponse = await app.request(`${serverOrigin}/api/v1/me`, {
      headers: { authorization: `Bearer ${created.secret}` },
    });
    expect(deniedResponse.status).toBe(401);

    const historyResponse = await app.request(`${serverOrigin}/api/v1/api-keys/${created.id}`, {
      headers,
    });
    expect(await historyResponse.json()).toMatchObject({ state: "revoked" });
  });

  it("publishes MCP authorization metadata without unauthenticated DCR", async () => {
    const resourceResponse = await app.request(
      `${serverOrigin}/.well-known/oauth-protected-resource/mcp`,
    );
    const resource = z
      .object({ resource: z.string(), scopes_supported: z.array(z.string()) })
      .parse(await resourceResponse.json());
    expect(resourceResponse.status).toBe(200);
    expect(resource).toMatchObject({
      resource: `${serverOrigin}/mcp`,
      scopes_supported: expect.arrayContaining(["taskome:access"]),
    });

    const metadataResponse = await app.request(
      `${serverOrigin}/.well-known/oauth-authorization-server/api/auth`,
    );
    const metadata = z
      .object({
        client_id_metadata_document_supported: z.boolean(),
        code_challenge_methods_supported: z.array(z.string()),
        registration_endpoint: z.string().optional(),
      })
      .parse(await metadataResponse.json());
    expect(metadataResponse.status).toBe(200);
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
    expect(metadata.client_id_metadata_document_supported).toBe(true);
    expect(metadata).not.toHaveProperty("registration_endpoint");
  });

  it("issues and refreshes a Grant-bound token for a pre-registered PKCE client", async () => {
    const test = (await auth.$context).test;
    const user = await test.saveUser(
      test.createUser({ email: "oauth-flow@example.com", emailVerified: true }),
    );
    const headers = await test.getAuthHeaders({ userId: user.id });
    headers.set("accept", "application/json");
    headers.set("content-type", "application/json");
    headers.set("origin", webOrigin);
    const redirectUri = "http://127.0.0.1:32123/oauth/callback";
    const clientId = await registerNativeOAuthClient(database.db, {
      name: "Integration Client",
      redirectUris: [redirectUri],
      resource: `${serverOrigin}/mcp`,
    });
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorize = new URL(`${serverOrigin}/api/auth/oauth2/authorize`);
    authorize.search = new URLSearchParams({
      client_id: clientId,
      code_challenge: challenge,
      code_challenge_method: "S256",
      redirect_uri: redirectUri,
      resource: `${serverOrigin}/mcp`,
      response_type: "code",
      scope: "openid offline_access taskome:access",
      state: "integration-state",
    }).toString();

    const postLoginLocation = await responseLocation(await app.request(authorize, { headers }));
    const postLoginQuery = new URL(postLoginLocation, serverOrigin).search.slice(1);
    const consentLocation = await responseLocation(
      await app.request(`${serverOrigin}/api/auth/oauth2/continue`, {
        body: JSON.stringify({ oauth_query: postLoginQuery, postLogin: true }),
        headers,
        method: "POST",
      }),
    );
    const consentQuery = new URL(consentLocation, serverOrigin).search.slice(1);
    const callbackLocation = await responseLocation(
      await app.request(`${serverOrigin}/api/auth/oauth2/consent`, {
        body: JSON.stringify({ accept: true, oauth_query: consentQuery }),
        headers,
        method: "POST",
      }),
    );
    const code = new URL(callbackLocation).searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenResponse = await app.request(`${serverOrigin}/api/auth/oauth2/token`, {
      body: new URLSearchParams({
        client_id: clientId,
        code: code ?? "",
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    const tokens = z
      .object({ access_token: z.string(), refresh_token: z.string() })
      .parse(await tokenResponse.json());
    expect(tokenResponse.status).toBe(200);
    const [grant] = await database.db
      .select()
      .from(oauthGrant)
      .where(and(eq(oauthGrant.clientId, clientId), eq(oauthGrant.ownerUserId, user.id)));
    expect(grant).toMatchObject({ state: "active" });

    const refreshBody = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    });
    const firstRefresh = await app.request(`${serverOrigin}/api/auth/oauth2/token`, {
      body: refreshBody,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(firstRefresh.status).toBe(200);
    const rotated = z
      .object({ access_token: z.string(), refresh_token: z.string() })
      .parse(await firstRefresh.json());
    const replayRefresh = await app.request(`${serverOrigin}/api/auth/oauth2/token`, {
      body: refreshBody,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(replayRefresh.status).toBe(200);

    const revokeResponse = await app.request(`${serverOrigin}/api/v1/oauth-grants/${grant?.id}`, {
      headers,
      method: "DELETE",
    });
    expect(revokeResponse.status).toBe(204);
    const revokedRefresh = await app.request(`${serverOrigin}/api/auth/oauth2/token`, {
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: rotated.refresh_token,
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(revokedRefresh.status).toBe(400);
  });

  it("revokes one OAuth Grant, its token family, replay response, consent, and audit atomically", async () => {
    const test = (await auth.$context).test;
    const user = await test.saveUser(
      test.createUser({ email: "grant-owner@example.com", emailVerified: true }),
    );
    const headers = await test.getAuthHeaders({ userId: user.id });
    const grantId = crypto.randomUUID();
    const clientId = `client-${crypto.randomUUID()}`;
    const now = new Date();
    await database.db.insert(oauthClient).values({
      clientId,
      id: crypto.randomUUID(),
      redirectUris: ["https://client.example/callback"],
    });
    await database.db.insert(oauthGrant).values({
      activatedAt: now,
      clientId,
      expiresAt: new Date(now.getTime() + 86_400_000),
      id: grantId,
      ownerUserId: user.id,
      resource: `${serverOrigin}/mcp`,
      scopes: ["taskome:access"],
      state: "active",
    });
    const grantService = createOAuthGrantService(database.db);
    await expect(
      grantService.activateAndClaim({
        clientId: "different-client",
        grantId,
        ownerUserId: user.id,
        resource: `${serverOrigin}/mcp`,
        scopes: ["taskome:access"],
      }),
    ).rejects.toThrow("not authoritative");
    const refreshId = crypto.randomUUID();
    await database.db.insert(oauthRefreshToken).values({
      clientId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 86_400_000),
      id: refreshId,
      referenceId: grantId,
      rotationReplayExpiresAt: new Date(now.getTime() + 30_000),
      rotationReplayResponse: "sensitive replay response",
      scopes: ["taskome:access"],
      token: `refresh-${crypto.randomUUID()}`,
      userId: user.id,
    });
    await database.db.insert(oauthAccessToken).values({
      clientId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 600_000),
      id: crypto.randomUUID(),
      referenceId: grantId,
      refreshId,
      scopes: ["taskome:access"],
      token: `access-${crypto.randomUUID()}`,
      userId: user.id,
    });
    await database.db.insert(oauthConsent).values({
      clientId,
      createdAt: now,
      id: crypto.randomUUID(),
      referenceId: grantId,
      scopes: ["taskome:access"],
      updatedAt: now,
      userId: user.id,
    });

    const response = await app.request(`${serverOrigin}/api/v1/oauth-grants/${grantId}`, {
      headers,
      method: "DELETE",
    });
    expect(response.status).toBe(204);

    const [grant] = await database.db.select().from(oauthGrant).where(eq(oauthGrant.id, grantId));
    const [refresh] = await database.db
      .select()
      .from(oauthRefreshToken)
      .where(eq(oauthRefreshToken.referenceId, grantId));
    const [access] = await database.db
      .select()
      .from(oauthAccessToken)
      .where(eq(oauthAccessToken.referenceId, grantId));
    const consents = await database.db
      .select()
      .from(oauthConsent)
      .where(eq(oauthConsent.referenceId, grantId));
    const events = await database.db
      .select()
      .from(securityEvent)
      .where(
        and(eq(securityEvent.grantId, grantId), eq(securityEvent.operation, "oauth_grant.revoked")),
      );
    expect(grant?.state).toBe("revoked");
    expect(refresh).toMatchObject({
      revoked: expect.any(Date),
      rotationReplayExpiresAt: null,
      rotationReplayResponse: null,
    });
    expect(access?.revoked).toBeInstanceOf(Date);
    expect(consents).toEqual([]);
    expect(events).toHaveLength(1);

    const firstRevokedAt = grant?.revokedAt;
    const repeatedResponse = await app.request(`${serverOrigin}/api/v1/oauth-grants/${grantId}`, {
      headers,
      method: "DELETE",
    });
    expect(repeatedResponse.status).toBe(204);
    const [repeatedGrant] = await database.db
      .select()
      .from(oauthGrant)
      .where(eq(oauthGrant.id, grantId));
    const repeatedEvents = await database.db
      .select()
      .from(securityEvent)
      .where(
        and(eq(securityEvent.grantId, grantId), eq(securityEvent.operation, "oauth_grant.revoked")),
      );
    expect(repeatedGrant?.revokedAt).toEqual(firstRevokedAt);
    expect(repeatedEvents).toHaveLength(1);
  });

  it("challenges unauthenticated MCP requests and keeps test helpers test-only", async () => {
    const response = await app.request(`${serverOrigin}/mcp`, {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "initialize", params: {} }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata");

    const { auth: productionAuth } = await import("@/auth");
    expect("test" in (await productionAuth.$context)).toBe(false);
    expect("test" in (await auth.$context)).toBe(true);
  });
});
