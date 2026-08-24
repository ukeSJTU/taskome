import { describe, expect, it } from "vitest";

import { createApp } from "./app";

const corsOrigin = "http://localhost:3001";

function createTestApp(
  overrides: {
    authHandler?: () => Response;
    checkReadiness?: () => Promise<void>;
    getSession?: () => Promise<null>;
  } = {},
) {
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
    getSession: overrides.getSession ?? (() => Promise.resolve(null)),
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
