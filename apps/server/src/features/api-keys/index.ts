import { OpenAPIHono } from "@hono/zod-openapi";

import { requireCredentialManagementSession } from "@/auth/require-credential-management-session";
import type { GetSession } from "@/auth/session";
import type { AppEnv } from "@/http/types";
import { createApiKeyHandlers } from "./api-key.handlers";
import {
  createApiKeyRoute,
  getApiKeyRoute,
  listApiKeysRoute,
  revokeApiKeyRoute,
  updateApiKeyRoute,
} from "./api-key.routes";
import type { ApiKeyService } from "./api-key.service";

export function createApiKeyRouter(options: { getSession: GetSession; service: ApiKeyService }) {
  const router = new OpenAPIHono<AppEnv>();
  const handlers = createApiKeyHandlers(options.service);
  router.use("/api-keys/*", requireCredentialManagementSession(options.getSession));
  router.use("/api-keys", requireCredentialManagementSession(options.getSession));
  router.openapi(createApiKeyRoute, handlers.create);
  router.openapi(listApiKeysRoute, handlers.list);
  router.openapi(getApiKeyRoute, handlers.get);
  router.openapi(updateApiKeyRoute, handlers.update);
  router.openapi(revokeApiKeyRoute, handlers.revoke);
  return router;
}

export { createApiKeyService } from "./api-key.service";
export type { ApiKeyService } from "./api-key.service";
