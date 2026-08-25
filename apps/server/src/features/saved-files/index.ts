import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import {
  requireSecurityContext,
  type RestSecurityContextResolver,
} from "@/auth/require-security-context";
import { ProblemDetailsSchema, problemDetails } from "@/http/errors/problem";
import type { AppEnv } from "@/http/types";
import type { SavedFilesModule } from "./saved-files-module";

export { createSavedFilesModule, type SavedFilesModule } from "./saved-files-module";
export { createS3ObjectStorage, type ObjectStorage } from "./object-storage";

const savedFileSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    filename: z.string(),
    contentType: z.string().nullable(),
    sizeBytes: z.number().int().positive(),
    status: z.enum(["pending", "uploaded"]),
    createdAt: z.iso.datetime(),
  })
  .openapi("SavedFile");
const uploadSchema = z
  .object({
    projectId: z.uuid(),
    filename: z.string().trim().min(1).max(1024),
    contentType: z.string().max(255).optional(),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(2 * 1024 * 1024 * 1024),
  })
  .openapi("CreateSavedFileUpload");
const idParams = z.object({ savedFileId: z.uuid() });
const problem = {
  content: { "application/problem+json": { schema: ProblemDetailsSchema } },
  description: "Request could not be completed",
};
const security = [{ apiKeyBearer: [] }, { cookieAuth: [] }, { oauthBearer: ["taskome:access"] }];

function route(
  method: "delete" | "get" | "post",
  path: string,
  operationId: string,
  options: Record<string, unknown>,
) {
  return createRoute({
    method,
    path,
    operationId,
    security,
    tags: ["Saved Files"],
    ...options,
  } as any);
}
const createUploadRoute = route("post", "/saved-files/uploads", "createSavedFileUpload", {
  request: { body: { content: { "application/json": { schema: uploadSchema } }, required: true } },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      savedFileSchema.extend({ uploadUrl: z.url() }),
      "Saved File upload URL",
    ),
    [HttpStatusCodes.NOT_FOUND]: problem,
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: problem,
  },
});
const listRoute = route("get", "/saved-files", "listSavedFiles", {
  request: { query: z.object({ projectId: z.uuid().optional() }) },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ items: z.array(savedFileSchema), nextCursor: z.null() }),
      "Saved Files",
    ),
  },
});
const confirmRoute = route("post", "/saved-files/{savedFileId}/confirm", "confirmSavedFileUpload", {
  request: { params: idParams },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(savedFileSchema, "Uploaded Saved File"),
    [HttpStatusCodes.NOT_FOUND]: problem,
    [HttpStatusCodes.CONFLICT]: problem,
  },
});
const downloadRoute = route("post", "/saved-files/{savedFileId}/download", "getSavedFileDownload", {
  request: { params: idParams },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      savedFileSchema.extend({ downloadUrl: z.url() }),
      "Saved File download URL",
    ),
    [HttpStatusCodes.NOT_FOUND]: problem,
    [HttpStatusCodes.CONFLICT]: problem,
  },
});
const deleteRoute = route("delete", "/saved-files/{savedFileId}", "deleteSavedFile", {
  request: { params: idParams },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: "Saved File deleted" },
    [HttpStatusCodes.NOT_FOUND]: problem,
  },
});

function failure(c: any, error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error ? String(error.code) : "internal_error";
  const status = code === "saved_file_unavailable" ? 409 : code.endsWith("not_found") ? 404 : 500;
  return c.json(
    problemDetails(c, {
      code,
      detail: error instanceof Error ? error.message : "The request failed.",
      status,
      title:
        status === 404
          ? "Not found"
          : status === 409
            ? "Saved File unavailable"
            : "Internal server error",
    }),
    status,
    { "content-type": "application/problem+json; charset=UTF-8" },
  );
}

export function createSavedFilesRouter({
  module,
  resolveSecurityContext,
}: {
  module: SavedFilesModule;
  resolveSecurityContext: RestSecurityContextResolver;
}) {
  const router = new OpenAPIHono<AppEnv>();
  router.use("*", requireSecurityContext(resolveSecurityContext, "taskome:access"));
  router.openapi(createUploadRoute as any, async (c: any) => {
    try {
      const file = await module.createUpload(c.get("securityContext").user.id, c.req.valid("json"));
      c.header("location", `/api/v1/saved-files/${file.id}`);
      return c.json(file, 201);
    } catch (error) {
      return failure(c, error);
    }
  });
  router.openapi(listRoute as any, async (c: any) => {
    try {
      return c.json(
        await module.listSavedFiles(
          c.get("securityContext").user.id,
          c.req.valid("query").projectId,
        ),
        200,
      );
    } catch (error) {
      return failure(c, error);
    }
  });
  router.openapi(confirmRoute as any, async (c: any) => {
    try {
      return c.json(
        await module.confirmUpload(
          c.get("securityContext").user.id,
          c.req.valid("param").savedFileId,
        ),
        200,
      );
    } catch (error) {
      return failure(c, error);
    }
  });
  router.openapi(downloadRoute as any, async (c: any) => {
    try {
      return c.json(
        await module.getDownload(
          c.get("securityContext").user.id,
          c.req.valid("param").savedFileId,
        ),
        200,
      );
    } catch (error) {
      return failure(c, error);
    }
  });
  router.openapi(deleteRoute as any, async (c: any) => {
    try {
      await module.deleteSavedFile(
        c.get("securityContext").user.id,
        c.req.valid("param").savedFileId,
      );
      return c.body(null, 204);
    } catch (error) {
      return failure(c, error);
    }
  });
  return router;
}
