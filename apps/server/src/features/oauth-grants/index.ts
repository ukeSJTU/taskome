import { OpenAPIHono } from "@hono/zod-openapi";

import { requireCredentialManagementSession } from "@/auth/require-credential-management-session";
import type { GetSession } from "@/auth/session";
import type { AppEnv } from "@/http/types";
import { createOAuthGrantHandlers } from "./oauth-grant.handlers";
import {
  getOAuthGrantRoute,
  listOAuthGrantsRoute,
  revokeOAuthGrantRoute,
} from "./oauth-grant.routes";
import type { OAuthGrantManagementService } from "./oauth-grant.service";

export function createOAuthGrantRouter(options: {
  getSession: GetSession;
  service: OAuthGrantManagementService;
}) {
  const router = new OpenAPIHono<AppEnv>();
  const handlers = createOAuthGrantHandlers(options.service);
  router.use("/oauth-grants", requireCredentialManagementSession(options.getSession));
  router.use("/oauth-grants/*", requireCredentialManagementSession(options.getSession));
  router.openapi(listOAuthGrantsRoute, handlers.list);
  router.openapi(getOAuthGrantRoute, handlers.get);
  router.openapi(revokeOAuthGrantRoute, handlers.revoke);
  return router;
}

export { createOAuthGrantManagementService } from "./oauth-grant.service";
export type { OAuthGrantManagementService } from "./oauth-grant.service";
