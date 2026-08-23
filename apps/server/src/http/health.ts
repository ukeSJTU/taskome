import type { OpenAPIHono } from "@hono/zod-openapi";

import { problemResponse } from "./errors/problem";
import type { AppEnv } from "./types";

export function registerHealthRoutes(
  app: OpenAPIHono<AppEnv>,
  checkReadiness: () => Promise<void>,
) {
  app.get("/healthz", (c) => c.json({ status: "ok" as const }, 200));
  app.get("/readyz", async (c) => {
    try {
      await checkReadiness();
      return c.json({ status: "ready" as const }, 200);
    } catch {
      return problemResponse(c, {
        code: "service_unavailable",
        detail: "A required service is unavailable.",
        status: 503,
        title: "Service unavailable",
      });
    }
  });
}
