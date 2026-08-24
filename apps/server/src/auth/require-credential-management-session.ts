import { createMiddleware } from "hono/factory";

import { problemResponse } from "@/http/errors/problem";
import type { AppEnv } from "@/http/types";
import type { GetSession } from "./session";

export const freshSessionSeconds = 60 * 15;

export function requireCredentialManagementSession(getSession: GetSession) {
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
        detail: "Sign in to manage programmatic access.",
        status: 401,
        title: "Unauthorized",
      });
    }
    if (!session.user.emailVerified) {
      return problemResponse(c, {
        code: "email_verification_required",
        detail: "Verify your email before managing programmatic access.",
        status: 403,
        title: "Forbidden",
      });
    }
    if (Date.now() - session.session.createdAt.getTime() > freshSessionSeconds * 1000) {
      return problemResponse(c, {
        code: "fresh_session_required",
        detail: "Sign in again before managing programmatic access.",
        status: 403,
        title: "Forbidden",
      });
    }

    c.set("session", session);
    c.get("log").set({ user: { id: session.user.id } });
    await next();
    return;
  });
}
