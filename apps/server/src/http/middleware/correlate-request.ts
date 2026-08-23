import { createMiddleware } from "hono/factory";

import type { AppEnv } from "@/http/types";

const validRequestId = /^[\w=-]+$/;

export function correlateRequest() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const candidate = c.req.header("x-request-id");
    const requestId =
      candidate && candidate.length <= 255 && validRequestId.test(candidate)
        ? candidate
        : crypto.randomUUID();

    c.req.raw.headers.set("x-request-id", requestId);
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    await next();
  });
}
