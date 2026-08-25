import { GenericContainer, Wait } from "testcontainers";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import { resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
import { oauthGrantClaim } from "@/auth/oauth-grants";
import type { DatabaseRuntime } from "@/db/database";
import {
  apikey,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthGrant,
  oauthRefreshToken,
  securityEvent,
  project,
} from "@/db/schema";
import { createApiKeyService } from "@/features/api-keys";
import { CreatedApiKeySchema } from "@/features/api-keys/api-key.schemas";
import { createOAuthGrantManagementService } from "@/features/oauth-grants";
import { createProjectsModule } from "@/features/projects";
import { createS3ObjectStorage, createSavedFilesModule } from "@/features/saved-files";

const serverOrigin = "http://127.0.0.1:31042";
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

async function registerUser(app: App, email: string) {
  const response = await app.request(`${serverOrigin}/api/auth/sign-up/email`, {
    body: JSON.stringify({
      email,
      name: "Projects User",
      password: "correct horse battery staple",
    }),
    headers: {
      "content-type": "application/json",
      origin: webOrigin,
    },
    method: "POST",
  });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];

  expect(response.status).toBe(200);
  expect(cookie).toBeTruthy();
  return cookie ?? "";
}

describe("server with PostgreSQL and Better Auth", () => {
  let app: App;
  let container: StartedPostgreSqlContainer;
  let database: DatabaseRuntime;
  let auth: (typeof import("@/auth.test-instance"))["testAuth"];
  let httpServer: ReturnType<typeof serve>;
  let objectStorage: Awaited<ReturnType<GenericContainer["start"]>>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:18.4-alpine3.24")
      .withDatabase("taskome_test")
      .withPassword("taskome_test")
      .withUsername("taskome_test")
      .start();
    objectStorage = await new GenericContainer("chrislusf/seaweedfs:4.42")
      .withEnvironment({
        AWS_ACCESS_KEY_ID: "taskome-development",
        AWS_SECRET_ACCESS_KEY: "taskome-development-only-secret",
        S3_BUCKET: "taskome-dev",
      })
      .withCommand(["mini", "-dir=/data", "-ip.bind=0.0.0.0", "-s3.allowedOrigins=*"])
      .withExposedPorts(8333)
      .withWaitStrategy(Wait.forHttp("/healthz", 8333))
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
    const savedFiles = createSavedFilesModule(
      database.db,
      createS3ObjectStorage({
        accessKeyId: "taskome-development",
        bucket: "taskome-dev",
        endpoint: `http://${objectStorage.getHost()}:${objectStorage.getMappedPort(8333)}`,
        secretAccessKey: "taskome-development-only-secret",
      }),
    );
    app = createApp({
      apiKeyService: createApiKeyService(auth, database.db),
      authHandler: (request) => withAuthRequestCorrelation(request, () => auth.handler(request)),
      checkReadiness: database.check,
      corsOrigin: webOrigin,
      drain: () => undefined,
      getSession,
      mcpHandler: createTaskomeMcpHandler(
        auth,
        createOAuthGrantService(database.db),
        serverOrigin,
        savedFiles,
      ),
      oauthGrantService: createOAuthGrantManagementService(database.db),
      projects: createProjectsModule(database.db),
      savedFiles,
      resolveSecurityContext: createRestSecurityContextResolver({
        getSession,
        resource: protectedResources(serverOrigin).rest,
        verifyApiKey: createApiKeyResolver(auth, database.db),
      }),
    });
    httpServer = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 31042 });
  });

  afterAll(async () => {
    await new Promise<void>((resolveClose, reject) => {
      httpServer?.close((error) => (error ? reject(error) : resolveClose()));
    });
    await database?.close();
    await container?.stop();
    await objectStorage?.stop();
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

  it("round-trips bytes through presigned Saved File URLs without confirmation", async () => {
    const cookie = await registerUser(app, "saved-file-round-trip@example.com");
    const me = await app.request("/api/v1/me", { headers: { cookie } });
    const currentUser = z.object({ id: z.string() }).parse(await me.json());
    const [defaultProject] = await database.db
      .select()
      .from(project)
      .where(eq(project.ownerUserId, currentUser.id))
      .limit(1);
    expect(defaultProject).toBeDefined();
    const upload = await app.request("/api/v1/saved-files/uploads", {
      body: JSON.stringify({ filename: "input.pdb", projectId: defaultProject?.id, sizeBytes: 9 }),
      headers: { "content-type": "application/json", cookie },
      method: "POST",
    });
    const issued = z.object({ id: z.string(), uploadUrl: z.url() }).parse(await upload.json());
    expect(upload.status).toBe(201);
    const uploaded = await fetch(issued.uploadUrl, {
      body: "ATOM\nEND\n",
      headers: { "content-length": "9", "if-none-match": "*" },
      method: "PUT",
    });
    expect(uploaded.ok).toBe(true);
    const download = await app.request(`/api/v1/saved-files/${issued.id}/download`, {
      headers: { cookie },
      method: "POST",
    });
    expect(download.status).toBe(200);
    const body = z.object({ downloadUrl: z.url() }).parse(await download.json());
    expect(await (await fetch(body.downloadUrl)).text()).toBe("ATOM\nEND\n");
    const deleted = await app.request(`/api/v1/saved-files/${issued.id}`, {
      headers: { cookie },
      method: "DELETE",
    });
    expect(deleted.status).toBe(204);
    expect((await fetch(body.downloadUrl)).status).toBe(404);
  });

  it("does not expose a Saved File to another user", async () => {
    const ownerCookie = await registerUser(app, "saved-file-owner@example.com");
    const otherCookie = await registerUser(app, "saved-file-other@example.com");
    const owner = z
      .object({ id: z.string() })
      .parse(await (await app.request("/api/v1/me", { headers: { cookie: ownerCookie } })).json());
    const [defaultProject] = await database.db
      .select()
      .from(project)
      .where(eq(project.ownerUserId, owner.id))
      .limit(1);
    const upload = await app.request("/api/v1/saved-files/uploads", {
      body: JSON.stringify({
        filename: "private.pdb",
        projectId: defaultProject?.id,
        sizeBytes: 1,
      }),
      headers: { "content-type": "application/json", cookie: ownerCookie },
      method: "POST",
    });
    const { id } = z.object({ id: z.string() }).parse(await upload.json());
    const response = await app.request(`/api/v1/saved-files/${id}/download`, {
      headers: { cookie: otherCookie },
      method: "POST",
    });
    expect(response.status).toBe(404);
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
    const jwtPayload = JSON.parse(
      Buffer.from(tokens.access_token.split(".")[1] ?? "", "base64url").toString("utf8"),
    );
    expect(jwtPayload[oauthGrantClaim]).toBe(grant?.id);

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
    const grantRefreshTokens = await database.db
      .select()
      .from(oauthRefreshToken)
      .where(eq(oauthRefreshToken.clientId, clientId));
    expect(grantRefreshTokens.length).toBeGreaterThanOrEqual(2);
    expect(grantRefreshTokens.every((token) => token.referenceId === grant?.id)).toBe(true);
    const replayRefresh = await app.request(`${serverOrigin}/api/auth/oauth2/token`, {
      body: refreshBody,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(replayRefresh.status).toBe(200);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 31_000));
    try {
      const expiredReplay = await app.request(`${serverOrigin}/api/auth/oauth2/token`, {
        body: refreshBody,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      });
      expect(expiredReplay.status).toBe(400);
    } finally {
      vi.useRealTimers();
    }

    const raceBody = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: rotated.refresh_token,
    });
    const [raceRefresh, revokeResponse] = await Promise.all([
      app.request(`${serverOrigin}/api/auth/oauth2/token`, {
        body: raceBody,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      }),
      app.request(`${serverOrigin}/api/v1/oauth-grants/${grant?.id}`, {
        headers,
        method: "DELETE",
      }),
    ]);
    expect(revokeResponse.status).toBe(204);
    expect([200, 400]).toContain(raceRefresh.status);
    const finalRefreshToken =
      raceRefresh.status === 200
        ? z.object({ refresh_token: z.string() }).parse(await raceRefresh.json()).refresh_token
        : rotated.refresh_token;
    const revokedRefresh = await app.request(`${serverOrigin}/api/auth/oauth2/token`, {
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: finalRefreshToken,
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(revokedRefresh.status).toBe(400);
    const revokedMcp = await app.request(`${serverOrigin}/mcp`, {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "initialize", params: {} }),
      headers: {
        authorization: `Bearer ${tokens.access_token}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(revokedMcp.status).toBe(401);
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

  it("re-authorizes changed scopes and cleans abandoned pending Grants", async () => {
    const test = (await auth.$context).test;
    const user = await test.saveUser(
      test.createUser({ email: "grant-transition@example.com", emailVerified: true }),
    );
    const clientId = `transition-${crypto.randomUUID()}`;
    await database.db.insert(oauthClient).values({
      clientId,
      id: crypto.randomUUID(),
      redirectUris: ["http://127.0.0.1:32123/oauth/callback"],
    });
    const grants = createOAuthGrantService(database.db);
    const firstId = await grants.createReference(
      user.id,
      { clientId, resource: `${serverOrigin}/mcp`, scopes: ["taskome:access"] },
      "scope-request-1",
    );
    await grants.activateAndClaim({
      clientId,
      grantId: firstId,
      ownerUserId: user.id,
      resource: `${serverOrigin}/mcp`,
      scopes: ["taskome:access"],
    });
    const replacementId = await grants.createReference(
      user.id,
      { clientId, resource: `${serverOrigin}/mcp`, scopes: [] },
      "scope-request-2",
    );
    const [first] = await database.db.select().from(oauthGrant).where(eq(oauthGrant.id, firstId));
    const [replacement] = await database.db
      .select()
      .from(oauthGrant)
      .where(eq(oauthGrant.id, replacementId));
    expect(first).toMatchObject({ state: "revoked" });
    expect(replacement).toMatchObject({ scopes: [], state: "pending" });

    const staleId = crypto.randomUUID();
    await database.db.insert(oauthGrant).values({
      clientId,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 86_400_000),
      id: staleId,
      ownerUserId: user.id,
      resource: `${serverOrigin}/mcp`,
      scopes: ["taskome:access"],
      state: "pending",
    });
    await grants.createReference(
      user.id,
      { clientId, resource: `${serverOrigin}/mcp`, scopes: ["taskome:access"] },
      "cleanup-request",
    );
    expect(await database.db.select().from(oauthGrant).where(eq(oauthGrant.id, staleId))).toEqual(
      [],
    );
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

  it("gives a newly registered user one Default Project", async () => {
    const signUpResponse = await app.request(`${serverOrigin}/api/auth/sign-up/email`, {
      body: JSON.stringify({
        email: "projects@example.com",
        name: "Projects User",
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

    const projectsResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: {
        cookie: cookie ?? "",
        origin: webOrigin,
      },
    });

    expect(projectsResponse.status).toBe(200);
    expect(await projectsResponse.json()).toEqual({
      items: [
        {
          archivedAt: null,
          createdAt: expect.any(String),
          description: null,
          id: expect.any(String),
          isDefault: true,
          name: "Default Project",
          status: "active",
          updatedAt: expect.any(String),
        },
      ],
      nextCursor: null,
    });
  });

  it("creates and lists a normalized private Project", async () => {
    const cookie = await registerUser(app, "create-project@example.com");

    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({
        description: "  Pocket detection candidates  ",
        name: "  Alpha  ",
      }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });

    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      archivedAt: null,
      description: "Pocket detection candidates",
      id: expect.any(String),
      isDefault: false,
      name: "Alpha",
      status: "active",
    });

    const listResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: { cookie, origin: webOrigin },
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({
      items: [{ name: "Default Project" }, { name: "Alpha" }],
      nextCursor: null,
    });
  });

  it("rejects a normalized Project name conflict", async () => {
    const cookie = await registerUser(app, "project-conflict@example.com");
    const create = (name: string) =>
      app.request(`${serverOrigin}/api/v1/projects`, {
        body: JSON.stringify({ name }),
        headers: {
          "content-type": "application/json",
          cookie,
          origin: webOrigin,
        },
        method: "POST",
      });

    const initialResponse = await create("Straße");
    const { id } = z.object({ id: z.string() }).parse(await initialResponse.json());
    const archiveResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}/archive`, {
      headers: { cookie, origin: webOrigin },
      method: "POST",
    });
    const conflictResponse = await create("  ＳＴＲＡＳＳＥ  ");

    expect(initialResponse.status).toBe(201);
    expect(archiveResponse.status).toBe(200);
    expect(conflictResponse.status).toBe(409);
    expect(await conflictResponse.json()).toMatchObject({
      code: "project_name_conflict",
      status: 409,
      title: "Project name already exists",
    });
  });

  it("rejects a blank Project name at the HTTP validation seam", async () => {
    const cookie = await registerUser(app, "project-validation@example.com");

    const response = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "   " }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "validation_failed",
      status: 422,
    });
  });

  it("applies Project text limits by Unicode code point", async () => {
    const cookie = await registerUser(app, "project-unicode-length@example.com");
    const acceptedResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({
        description: "🧬".repeat(1000),
        name: "🧬".repeat(100),
      }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const rejectedResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "🧬".repeat(101) }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });

    expect(acceptedResponse.status).toBe(201);
    expect(rejectedResponse.status).toBe(422);
  });

  it("paginates the stable Project ordering with an opaque cursor", async () => {
    const cookie = await registerUser(app, "project-pagination@example.com");
    const create = (name: string) =>
      app.request(`${serverOrigin}/api/v1/projects`, {
        body: JSON.stringify({ name }),
        headers: {
          "content-type": "application/json",
          cookie,
          origin: webOrigin,
        },
        method: "POST",
      });
    expect((await create("Beta")).status).toBe(201);
    expect((await create("Alpha")).status).toBe(201);

    const firstResponse = await app.request(`${serverOrigin}/api/v1/projects?limit=2`, {
      headers: { cookie, origin: webOrigin },
    });
    const first = z
      .object({
        items: z.array(z.object({ name: z.string() })).length(2),
        nextCursor: z.string(),
      })
      .parse(await firstResponse.json());
    const secondResponse = await app.request(
      `${serverOrigin}/api/v1/projects?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`,
      { headers: { cookie, origin: webOrigin } },
    );

    expect(first.items.map((project) => project.name)).toEqual(["Default Project", "Alpha"]);
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toMatchObject({
      items: [{ name: "Beta" }],
      nextCursor: null,
    });
  });

  it("returns a Project only to its owner", async () => {
    const ownerCookie = await registerUser(app, "project-owner@example.com");
    const otherCookie = await registerUser(app, "project-other@example.com");
    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "Private Project" }),
      headers: {
        "content-type": "application/json",
        cookie: ownerCookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const { id } = z.object({ id: z.string() }).parse(await createResponse.json());

    const ownerResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      headers: { cookie: ownerCookie, origin: webOrigin },
    });
    const otherResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      headers: { cookie: otherCookie, origin: webOrigin },
    });

    expect(ownerResponse.status).toBe(200);
    expect(await ownerResponse.json()).toMatchObject({ id, name: "Private Project" });
    expect(otherResponse.status).toBe(404);
    expect(await otherResponse.json()).toMatchObject({
      code: "project_not_found",
      status: 404,
      title: "Project not found",
    });
  });

  it("updates an active regular Project", async () => {
    const cookie = await registerUser(app, "project-update@example.com");
    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ description: "Initial", name: "Original" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const { id } = z.object({ id: z.string() }).parse(await createResponse.json());

    const updateResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      body: JSON.stringify({ description: null, name: "  Renamed  " }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "PATCH",
    });

    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({
      description: null,
      id,
      name: "Renamed",
      status: "active",
    });
  });

  it("keeps the Default Project name immutable while allowing its description", async () => {
    const cookie = await registerUser(app, "default-project-update@example.com");
    const listResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: { cookie, origin: webOrigin },
    });
    const { id } = z
      .object({ items: z.tuple([z.object({ id: z.string() })]) })
      .parse(await listResponse.json()).items[0];

    const renameResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      body: JSON.stringify({ name: "Renamed Default" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "PATCH",
    });
    const describeResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      body: JSON.stringify({ description: "Fallback for unassigned work" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "PATCH",
    });

    expect(renameResponse.status).toBe(409);
    expect(await renameResponse.json()).toMatchObject({
      code: "default_project_immutable",
      status: 409,
    });
    expect(describeResponse.status).toBe(200);
    expect(await describeResponse.json()).toMatchObject({
      description: "Fallback for unassigned work",
      name: "Default Project",
    });
  });

  it("archives, filters, protects, and restores a regular Project", async () => {
    const cookie = await registerUser(app, "project-archive@example.com");
    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "Completed Study" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const { id } = z.object({ id: z.string() }).parse(await createResponse.json());

    const archiveResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}/archive`, {
      headers: { cookie, origin: webOrigin },
      method: "POST",
    });
    const activeListResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: { cookie, origin: webOrigin },
    });
    const archivedListResponse = await app.request(
      `${serverOrigin}/api/v1/projects?status=archived`,
      { headers: { cookie, origin: webOrigin } },
    );
    const updateResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      body: JSON.stringify({ description: "Cannot edit while archived" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "PATCH",
    });
    const unarchiveResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}/unarchive`, {
      headers: { cookie, origin: webOrigin },
      method: "POST",
    });

    expect(archiveResponse.status).toBe(200);
    expect(await archiveResponse.json()).toMatchObject({ id, status: "archived" });
    expect(await activeListResponse.json()).toMatchObject({
      items: [{ name: "Default Project" }],
    });
    expect(await archivedListResponse.json()).toMatchObject({
      items: [{ id, name: "Completed Study", status: "archived" }],
    });
    expect(updateResponse.status).toBe(409);
    expect(await updateResponse.json()).toMatchObject({ code: "project_archived" });
    expect(unarchiveResponse.status).toBe(200);
    expect(await unarchiveResponse.json()).toMatchObject({ id, status: "active" });
  });

  it("deletes an empty regular Project but protects the Default Project", async () => {
    const cookie = await registerUser(app, "project-delete@example.com");
    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "Disposable" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const { id } = z.object({ id: z.string() }).parse(await createResponse.json());
    const listResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: { cookie, origin: webOrigin },
    });
    const defaultProject = z
      .object({ items: z.array(z.object({ id: z.string(), isDefault: z.boolean() })) })
      .parse(await listResponse.json())
      .items.find((project) => project.isDefault);
    expect(defaultProject).toBeDefined();

    const deleteResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      headers: { cookie, origin: webOrigin },
      method: "DELETE",
    });
    const deletedGetResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      headers: { cookie, origin: webOrigin },
    });
    const defaultDeleteResponse = await app.request(
      `${serverOrigin}/api/v1/projects/${defaultProject?.id}`,
      { headers: { cookie, origin: webOrigin }, method: "DELETE" },
    );

    expect(deleteResponse.status).toBe(204);
    expect(deletedGetResponse.status).toBe(404);
    expect(defaultDeleteResponse.status).toBe(409);
    expect(await defaultDeleteResponse.json()).toMatchObject({
      code: "default_project_immutable",
    });
  });
});
