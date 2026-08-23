import { OpenAPIHono } from "@hono/zod-openapi";

import { requireSession } from "@/auth/require-session";
import type { GetSession } from "@/auth/session";
import type { AppEnv } from "@/http/types";
import { meHandler } from "./me.handlers";
import { meRoute } from "./me.routes";

// TODO(server-scaffold): Delete this entire example feature when the first real
// business feature is introduced. It exists only to establish the protected
// route → handler → module → schema structure; Better Auth's getSession and
// useSession already provide all current-user behavior exposed here.
interface MeRouterOptions {
  getSession: GetSession;
}

export function createMeRouter({ getSession }: MeRouterOptions) {
  const router = new OpenAPIHono<AppEnv>();
  router.use("*", requireSession(getSession));
  router.openapi(meRoute, meHandler);
  return router;
}
