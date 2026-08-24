import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { evlog, type EvlogHonoOptions } from "evlog/hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import type { SessionIdentity } from "@/auth/session";
import { createProjectsRouter, type ProjectsModule } from "@/features/projects";
import { problemResponse, validationHook } from "@/http/errors/problem";
import { registerHealthRoutes } from "@/http/health";
import { correlateRequest } from "@/http/middleware/correlate-request";
import type { AppEnv } from "@/http/types";

export interface AppOptions {
  authHandler: (request: Request) => Promise<Response> | Response;
  checkReadiness: () => Promise<void>;
  corsOrigin: string;
  drain?: EvlogHonoOptions["drain"];
  getSession: (headers: Headers) => Promise<SessionIdentity | null>;
  projects: ProjectsModule;
  resolveClientIp?: (context: Context<AppEnv>) => string | undefined;
}

export function createApp({
  authHandler,
  checkReadiness,
  corsOrigin,
  drain,
  getSession,
  projects,
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

  app.all("/api/auth/*", (c) => {
    const clientIp = resolveClientIp?.(c);
    if (!clientIp) return authHandler(c.req.raw);

    const headers = new Headers(c.req.raw.headers);
    headers.set("x-forwarded-for", clientIp);
    return authHandler(new Request(c.req.raw, { headers }));
  });

  registerHealthRoutes(app, checkReadiness);
  app.route("/api/v1", createProjectsRouter({ getSession, projects }));

  app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
    in: "cookie",
    name: "better-auth.session_token",
    type: "apiKey",
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
