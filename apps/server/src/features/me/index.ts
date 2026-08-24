import { OpenAPIHono } from "@hono/zod-openapi";

import {
  requireSecurityContext,
  type RestSecurityContextResolver,
} from "@/auth/require-security-context";
import type { AppEnv } from "@/http/types";
import { meHandler } from "./me.handlers";
import { meRoute } from "./me.routes";

// TODO(server-scaffold): Delete this entire example feature when the first real
// business feature is introduced. It exists only to establish the protected
// route → handler → module → schema structure; Better Auth's getSession and
// useSession already provide all current-user behavior exposed here.
interface MeRouterOptions {
  resolveSecurityContext: RestSecurityContextResolver;
}

export function createMeRouter({ resolveSecurityContext }: MeRouterOptions) {
  const router = new OpenAPIHono<AppEnv>();
  router.use("*", requireSecurityContext(resolveSecurityContext, "taskome:access"));
  router.openapi(meRoute, meHandler);
  return router;
}
