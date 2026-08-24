import type { RouteHandler } from "@hono/zod-openapi";

import type { AppEnv } from "@/http/types";
import { getCurrentUser } from "./me.module";
import type { MeRoute } from "./me.routes";

export const meHandler: RouteHandler<MeRoute, AppEnv> = (c) => {
  return c.json(getCurrentUser(c.get("securityContext").user), 200);
};
