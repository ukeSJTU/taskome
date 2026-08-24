import { createMiddleware } from "hono/factory";

import { problemResponse } from "@/http/errors/problem";
import type { AppEnv } from "@/http/types";
import type { GetSession } from "./session";

export function requireSession(getSession: GetSession) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (c.req.header("authorization")) {
      return problemResponse(c, {
        code: "unauthorized",
        detail: "Present exactly one credential type.",
        status: 401,
        title: "Unauthorized",
      });
    }

    const session = await getSession(c.req.raw.headers);
    if (!session) {
      return problemResponse(c, {
        code: "unauthorized",
        detail: "Sign in to access this resource.",
        status: 401,
        title: "Unauthorized",
      });
    }

    c.set("session", session);
    c.get("log").set({ user: { id: session.user.id } });
    await next();
    return;
  });
}
