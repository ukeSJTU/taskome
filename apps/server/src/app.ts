import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { evlog, type EvlogHonoOptions } from "evlog/hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import type { SessionIdentity } from "@/auth/session";
import type { RestSecurityContextResolver } from "@/auth/require-security-context";
import { createApiKeyRouter, type ApiKeyService } from "@/features/api-keys";
import { createOAuthGrantRouter, type OAuthGrantManagementService } from "@/features/oauth-grants";
import { createMeRouter } from "@/features/me";
import { createProjectsRouter, type ProjectsModule } from "@/features/projects";
import { problemResponse, validationHook } from "@/http/errors/problem";
import { registerHealthRoutes } from "@/http/health";
import { correlateRequest } from "@/http/middleware/correlate-request";
import type { AppEnv } from "@/http/types";

export interface AppOptions {
  apiKeyService?: ApiKeyService;
  authHandler: (request: Request) => Promise<Response> | Response;
  checkReadiness: () => Promise<void>;
  corsOrigin: string;
  drain?: EvlogHonoOptions["drain"];
  getSession: (headers: Headers) => Promise<SessionIdentity | null>;
  mcpHandler?: (request: Request) => Promise<Response> | Response;
  oauthGrantService?: OAuthGrantManagementService;
  projects: ProjectsModule;
  resolveSecurityContext: RestSecurityContextResolver;
  resolveClientIp?: (context: Context<AppEnv>) => string | undefined;
}

const blockedAuthManagementPaths = new Set([
  "/api/auth/oauth2/client/rotate-secret",
  "/api/auth/oauth2/create-client",
  "/api/auth/oauth2/delete-client",
  "/api/auth/oauth2/delete-consent",
  "/api/auth/oauth2/get-client",
  "/api/auth/oauth2/get-clients",
  "/api/auth/oauth2/get-consent",
  "/api/auth/oauth2/get-consents",
  "/api/auth/oauth2/update-client",
  "/api/auth/oauth2/update-consent",
]);

export function createApp({
  apiKeyService,
  authHandler,
  checkReadiness,
  corsOrigin,
  drain,
  getSession,
  mcpHandler,
  oauthGrantService,
  projects,
  resolveSecurityContext,
  resolveClientIp,
}: AppOptions) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  app.use("*", correlateRequest());
  app.use(
    "*",
    evlog({
      exclude: ["/healthz", "/readyz", "/openapi.json", "/reference"],
      ...(drain ? { drain } : {}),
    }),
  );
  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      credentials: true,
      origin: corsOrigin,
    }),
  );

  const forwardAuth = (c: Context<AppEnv>) => {
    const clientIp = resolveClientIp?.(c);
    if (!clientIp) return authHandler(c.req.raw);

    const headers = new Headers(c.req.raw.headers);
    headers.set("x-forwarded-for", clientIp);
    return authHandler(new Request(c.req.raw, { headers }));
  };

  app.all("/api/auth/api-key/*", (c) =>
    problemResponse(c, {
      code: "not_found",
      detail: "Use Taskome's programmatic-access operations.",
      status: 404,
      title: "Not found",
    }),
  );
  app.all("/api/auth/admin/oauth2/*", (c) =>
    problemResponse(c, {
      code: "not_found",
      detail: "Use Taskome's programmatic-access operations.",
      status: 404,
      title: "Not found",
    }),
  );
  app.all("/api/auth/*", (c) => {
    if (blockedAuthManagementPaths.has(c.req.path)) {
      return problemResponse(c, {
        code: "not_found",
        detail: "Use Taskome's programmatic-access operations.",
        status: 404,
        title: "Not found",
      });
    }
    return forwardAuth(c);
  });
  app.all("/.well-known/*", forwardAuth);
  if (mcpHandler) app.post("/mcp", (c) => mcpHandler(c.req.raw));

  registerHealthRoutes(app, checkReadiness);
  app.route("/api/v1", createMeRouter({ resolveSecurityContext }));
  if (apiKeyService) {
    app.route("/api/v1", createApiKeyRouter({ getSession, service: apiKeyService }));
  }
  if (oauthGrantService) {
    app.route("/api/v1", createOAuthGrantRouter({ getSession, service: oauthGrantService }));
  }
  app.route("/api/v1", createProjectsRouter({ getSession, projects }));

  app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
    in: "cookie",
    name: "better-auth.session_token",
    type: "apiKey",
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "apiKeyBearer", {
    bearerFormat: "Taskome API key (sk-…)",
    scheme: "bearer",
    type: "http",
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "oauthBearer", {
    flows: {
      authorizationCode: {
        authorizationUrl: "/api/auth/oauth2/authorize",
        scopes: { "taskome:access": "Access the development Taskome resource" },
        tokenUrl: "/api/auth/oauth2/token",
      },
    },
    type: "oauth2",
  });
  app.doc31("/openapi.json", {
    info: {
      description: "Taskome control-plane API",
      title: "Taskome API",
      version: "1.0.0",
    },
    openapi: "3.1.0",
  });
  app.get(
    "/reference",
    Scalar({
      pageTitle: "Taskome API Reference",
      url: "/openapi.json",
    }),
  );

  app.notFound((c) =>
    problemResponse(c, {
      code: "not_found",
      detail: `No route matches ${c.req.method} ${c.req.path}`,
      status: 404,
      title: "Not found",
    }),
  );
  app.onError((error, c) => {
    c.get("log")?.error(error);
    return problemResponse(c, {
      code: "internal_error",
      detail: "The server could not complete the request.",
      status: 500,
      title: "Internal server error",
    });
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
