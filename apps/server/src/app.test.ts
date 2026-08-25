import { describe, expect, it } from "vitest";

import { createApp, type AppOptions } from "./app";
import { createRestSecurityContextResolver } from "./auth/security-context";
import type { SavedFilesModule } from "./features/saved-files";

const corsOrigin = "http://localhost:3001";

function createTestApp(
  overrides: {
    authHandler?: () => Response;
    checkReadiness?: () => Promise<void>;
    getSession?: AppOptions["getSession"];
    resolveSecurityContext?: AppOptions["resolveSecurityContext"];
    savedFiles?: SavedFilesModule;
  } = {},
) {
  const getSession = overrides.getSession ?? (() => Promise.resolve(null));
  return createApp({
    apiKeyService: {
      create: () => Promise.reject(new Error("not used")),
      get: () => Promise.resolve(null),
      list: () => Promise.resolve([]),
      revoke: () => Promise.resolve(false),
      update: () => Promise.resolve(null),
    },
    authHandler: overrides.authHandler ?? (() => new Response("auth handler")),
    checkReadiness: overrides.checkReadiness ?? (() => Promise.resolve()),
    corsOrigin,
    drain: () => undefined,
    getSession,
    oauthGrantService: {
      get: () => Promise.resolve(undefined),
      list: () => Promise.resolve([]),
      revoke: () => Promise.resolve(false),
    },
    projects: {
      archiveProject: () => Promise.reject(new Error("unused test Project method")),
      createProject: () => Promise.reject(new Error("unused test Project method")),
      deleteProject: () => Promise.reject(new Error("unused test Project method")),
      getProject: () => Promise.reject(new Error("unused test Project method")),
      listProjects: () => Promise.resolve({ items: [], nextCursor: null }),
      unarchiveProject: () => Promise.reject(new Error("unused test Project method")),
      updateProject: () => Promise.reject(new Error("unused test Project method")),
    },
    savedFiles:
      overrides.savedFiles ??
      ({
        confirmUpload: () => Promise.reject(new Error("unused test Saved File method")),
        createUpload: () => Promise.reject(new Error("unused test Saved File method")),
        deleteSavedFile: () => Promise.reject(new Error("unused test Saved File method")),
        getDownload: () => Promise.reject(new Error("unused test Saved File method")),
        listSavedFiles: () => Promise.resolve({ items: [], nextCursor: null }),
      } satisfies SavedFilesModule),
    resolveSecurityContext:
      overrides.resolveSecurityContext ??
      createRestSecurityContextResolver({
        getSession,
        resource: "http://localhost:3000/api/v1",
        verifyApiKey: () => Promise.resolve(null),
      }),
  });
}

describe("server HTTP interface", () => {
  it("reports liveness without checking dependencies", async () => {
    let readinessChecks = 0;
    const app = createTestApp({
      checkReadiness: () => {
        readinessChecks += 1;
        return Promise.resolve();
      },
    });

    const response = await app.request("/healthz");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(readinessChecks).toBe(0);
  });

  it("reports readiness when PostgreSQL is reachable", async () => {
    const app = createTestApp();

    const response = await app.request("/readyz");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });

  it("returns a safe problem when PostgreSQL is unavailable", async () => {
    const app = createTestApp({
      checkReadiness: () => Promise.reject(new Error("password leaked by driver")),
    });

    const response = await app.request("/readyz");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(body).toMatchObject({
      code: "service_unavailable",
      status: 503,
      title: "Service unavailable",
    });
    expect(JSON.stringify(body)).not.toContain("password leaked");
  });

  it("serves the business OpenAPI document and Scalar reference", async () => {
    const app = createTestApp();

    const documentResponse = await app.request("/openapi.json");
    const document = await documentResponse.json();
    const referenceResponse = await app.request("/reference");

    expect(documentResponse.status).toBe(200);
    expect(document).toMatchObject({
      info: { title: "Taskome API" },
      openapi: "3.1.0",
    });
    expect(document).toHaveProperty(["paths", "/api/v1/me"]);
    expect(document).toHaveProperty(["paths", "/api/v1/api-keys"]);
    expect(document).toHaveProperty(["paths", "/api/v1/oauth-grants"]);
    expect(document).toHaveProperty(["paths", "/api/v1/projects"]);
    expect(document).not.toHaveProperty(["paths", "/api/auth/{path}"]);
    expect(referenceResponse.status).toBe(200);
    expect(referenceResponse.headers.get("content-type")).toContain("text/html");
  });

  it("requires a session for the current-user interface", async () => {
    const app = createTestApp();

    const response = await app.request("/api/v1/me");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "unauthorized",
      status: 401,
      title: "Unauthorized",
    });
  });

  it("issues an upload URL only for a Project owned by the caller", async () => {
    let ownerUserId: string | undefined;
    const app = createTestApp({
      resolveSecurityContext: () =>
        Promise.resolve({
          correlation: { requestId: "request-1" },
          credential: { id: "key-1", type: "api_key" },
          resource: "http://localhost:3000/api/v1",
          scopes: ["taskome:access"],
          user: {
            email: "developer@example.com",
            emailVerified: true,
            id: "user-1",
            image: null,
            name: "Developer",
          },
        }),
      savedFiles: {
        confirmUpload: () => Promise.reject(new Error("unused")),
        createUpload: (owner, input) => {
          ownerUserId = owner;
          return Promise.resolve({
            ...input,
            contentType: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            id: "00000000-0000-4000-8000-000000000002",
            status: "pending",
            uploadUrl: "https://storage.example/upload",
          });
        },
        deleteSavedFile: () => Promise.reject(new Error("unused")),
        getDownload: () => Promise.reject(new Error("unused")),
        listSavedFiles: () => Promise.resolve({ items: [], nextCursor: null }),
      },
    });

    const response = await app.request("/api/v1/saved-files/uploads", {
      body: JSON.stringify({
        filename: "protein.pdb",
        projectId: "00000000-0000-4000-8000-000000000001",
        sizeBytes: 12,
      }),
      headers: { authorization: "Bearer sk-valid", "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      filename: "protein.pdb",
      uploadUrl: "https://storage.example/upload",
    });
    expect(ownerUserId).toBe("user-1");
  });

  it("validates Saved File upload metadata before reaching the module", async () => {
    const app = createTestApp({
      resolveSecurityContext: () =>
        Promise.resolve({
          correlation: { requestId: "request-1" },
          credential: { id: "key-1", type: "api_key" },
          resource: "http://localhost:3000/api/v1",
          scopes: ["taskome:access"],
          user: {
            email: "developer@example.com",
            emailVerified: true,
            id: "user-1",
            image: null,
            name: "Developer",
          },
        }),
    });
    const response = await app.request("/api/v1/saved-files/uploads", {
      body: JSON.stringify({
        filename: "too-big",
        projectId: "00000000-0000-4000-8000-000000000001",
        sizeBytes: 2 * 1024 * 1024 * 1024 + 1,
      }),
      headers: { authorization: "Bearer sk-valid", "content-type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(422);
  });

  it("reports an unconfirmed Saved File as unavailable", async () => {
    const app = createTestApp({
      resolveSecurityContext: () =>
        Promise.resolve({
          correlation: { requestId: "request-1" },
          credential: { id: "key-1", type: "api_key" },
          resource: "http://localhost:3000/api/v1",
          scopes: ["taskome:access"],
          user: {
            email: "developer@example.com",
            emailVerified: true,
            id: "user-1",
            image: null,
            name: "Developer",
          },
        }),
      savedFiles: {
        createUpload: () => Promise.reject(new Error("unused")),
        listSavedFiles: () => Promise.resolve({ items: [], nextCursor: null }),
        confirmUpload: () =>
          Promise.reject(
            Object.assign(new Error("not uploaded"), { code: "saved_file_unavailable" }),
          ),
        deleteSavedFile: () => Promise.reject(new Error("unused")),
        getDownload: () => Promise.reject(new Error("unused")),
      },
    });
    const response = await app.request(
      "/api/v1/saved-files/00000000-0000-4000-8000-000000000001/confirm",
      { headers: { authorization: "Bearer sk-valid" }, method: "POST" },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "saved_file_unavailable" });
  });

  it("rejects competing browser and bearer credentials", async () => {
    const app = createTestApp();

    const response = await app.request("/api/v1/me", {
      headers: {
        authorization: "Bearer sk-competing",
        cookie: "better-auth.session_token=session",
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "unauthorized",
      detail: "Present exactly one credential type.",
    });
  });

  it("shields Better Auth API-key management endpoints", async () => {
    const app = createTestApp();

    const response = await app.request("/api/auth/api-key/list");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
  });

  it("shields Better Auth OAuth management while retaining protocol routes", async () => {
    const app = createTestApp();

    const response = await app.request("/api/auth/oauth2/create-client", { method: "POST" });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
  });

  it("requires verified email and a fresh session for API-key creation", async () => {
    const session = {
      session: { createdAt: new Date(), id: "session-1" },
      user: {
        email: "unverified@example.com",
        emailVerified: false,
        id: "user-1",
        image: null,
        name: "Unverified User",
      },
    };
    const app = createTestApp({ getSession: () => Promise.resolve(session) });

    const response = await app.request("/api/v1/api-keys", {
      body: JSON.stringify({ name: "automation", scopes: ["taskome:access"] }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "email_verification_required" });
  });

  it("requires reauthentication when the management session is stale", async () => {
    const session = {
      session: { createdAt: new Date(Date.now() - 16 * 60 * 1000), id: "session-1" },
      user: {
        email: "verified@example.com",
        emailVerified: true,
        id: "user-1",
        image: null,
        name: "Verified User",
      },
    };
    const app = createTestApp({ getSession: () => Promise.resolve(session) });

    const response = await app.request("/api/v1/oauth-grants");

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "fresh_session_required" });
  });

  it("rejects an API key that lacks the operation scope", async () => {
    const app = createTestApp({
      resolveSecurityContext: () =>
        Promise.resolve({
          correlation: { requestId: "request-1" },
          credential: { id: "key-1", type: "api_key" },
          resource: "http://localhost:3000/api/v1",
          scopes: [],
          user: {
            email: "developer@example.com",
            emailVerified: true,
            id: "user-1",
            image: null,
            name: "Developer",
          },
        }),
    });

    const response = await app.request("/api/v1/me", {
      headers: { authorization: "Bearer sk-valid" },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "insufficient_scope" });
  });

  it("uses the configured credentialed CORS origin", async () => {
    const app = createTestApp();

    const response = await app.request("/api/auth/ok", {
      headers: { Origin: corsOrigin },
      method: "OPTIONS",
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(corsOrigin);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("returns the shared problem shape for unknown routes", async () => {
    const app = createTestApp();

    const response = await app.request("/missing");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(await response.json()).toMatchObject({
      code: "not_found",
      status: 404,
      title: "Not found",
    });
  });

  it("keeps a valid caller request ID on responses and problems", async () => {
    const app = createTestApp();

    const response = await app.request("/missing", {
      headers: { "x-request-id": "caller-request-123" },
    });

    expect(response.headers.get("x-request-id")).toBe("caller-request-123");
    expect(await response.json()).toMatchObject({ requestId: "caller-request-123" });
  });

  it("returns a safe problem for an unhandled application failure", async () => {
    const app = createTestApp({
      authHandler: () => {
        throw new Error("secret driver detail");
      },
    });

    const response = await app.request("/api/auth/failure");
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ code: "internal_error", status: 500 });
    expect(JSON.stringify(body)).not.toContain("secret driver detail");
  });
});
