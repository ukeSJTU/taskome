import { OpenAPIHono } from "@hono/zod-openapi";

import {
  requireSecurityContext,
  type RestSecurityContextResolver,
} from "@/auth/require-security-context";
import type { AppEnv } from "@/http/types";
import { createSavedFileHandlers } from "./saved-files-handlers";
import {
  confirmRoute,
  createUploadRoute,
  deleteRoute,
  downloadRoute,
  listRoute,
} from "./saved-files-contracts";
import type { SavedFilesModule } from "./saved-files-module";

export { createSavedFilesModule, type SavedFilesModule } from "./saved-files-module";
export { createS3ObjectStorage, type ObjectStorage } from "./object-storage";
export { registerSavedFileTools } from "./mcp-tools";

export function createSavedFilesRouter({
  module,
  resolveSecurityContext,
}: {
  module: SavedFilesModule;
  resolveSecurityContext: RestSecurityContextResolver;
}) {
  const router = new OpenAPIHono<AppEnv>();
  const handlers = createSavedFileHandlers(module);
  router.use("*", requireSecurityContext(resolveSecurityContext, "taskome:access"));
  router.openapi(createUploadRoute as any, handlers.createUpload);
  router.openapi(listRoute as any, handlers.list);
  router.openapi(confirmRoute as any, handlers.confirm);
  router.openapi(downloadRoute as any, handlers.download);
  router.openapi(deleteRoute as any, handlers.remove);
  return router;
}
