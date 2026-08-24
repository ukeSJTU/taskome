import { createMiddleware } from "hono/factory";

import { problemResponse } from "@/http/errors/problem";
import type { AppEnv } from "@/http/types";
import { hasRequiredScope, type createRestSecurityContextResolver } from "./security-context";
import type { TaskomeScope } from "./scopes";

export type RestSecurityContextResolver = ReturnType<typeof createRestSecurityContextResolver>;

export function requireSecurityContext(
  resolveSecurityContext: RestSecurityContextResolver,
  requiredScope: TaskomeScope,
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    let securityContext;
    try {
      securityContext = await resolveSecurityContext(c.req.raw, {
        requestId: c.get("requestId"),
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "multiple_credentials") throw error;
      return problemResponse(c, {
        code: "unauthorized",
        detail: "Present exactly one credential type.",
        status: 401,
        title: "Unauthorized",
      });
    }

    if (!securityContext) {
      return problemResponse(c, {
        code: "unauthorized",
        detail: "Present a valid credential to access this resource.",
        status: 401,
        title: "Unauthorized",
      });
    }
    if (!hasRequiredScope(securityContext, requiredScope)) {
      return problemResponse(c, {
        code: "insufficient_scope",
        detail: `This operation requires the ${requiredScope} scope.`,
        status: 403,
        title: "Forbidden",
      });
    }

    c.set("securityContext", securityContext);
    c.get("log").set({ user: { id: securityContext.user.id } });
    await next();
    return;
  });
}
