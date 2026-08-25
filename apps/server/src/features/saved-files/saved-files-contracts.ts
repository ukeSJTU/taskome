import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { ProblemDetailsSchema } from "@/http/errors/problem";

export const savedFileSchema = z
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
export const uploadSchema = z
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

export const createUploadRoute = route("post", "/saved-files/uploads", "createSavedFileUpload", {
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
export const listRoute = route("get", "/saved-files", "listSavedFiles", {
  request: { query: z.object({ projectId: z.uuid().optional() }) },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ items: z.array(savedFileSchema), nextCursor: z.null() }),
      "Saved Files",
    ),
  },
});
export const confirmRoute = route(
  "post",
  "/saved-files/{savedFileId}/confirm",
  "confirmSavedFileUpload",
  {
    request: { params: idParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(savedFileSchema, "Uploaded Saved File"),
      [HttpStatusCodes.NOT_FOUND]: problem,
      [HttpStatusCodes.CONFLICT]: problem,
    },
  },
);
export const downloadRoute = route(
  "post",
  "/saved-files/{savedFileId}/download",
  "getSavedFileDownload",
  {
    request: { params: idParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        savedFileSchema.extend({ downloadUrl: z.url() }),
        "Saved File download URL",
      ),
      [HttpStatusCodes.NOT_FOUND]: problem,
      [HttpStatusCodes.CONFLICT]: problem,
    },
  },
);
export const deleteRoute = route("delete", "/saved-files/{savedFileId}", "deleteSavedFile", {
  request: { params: idParams },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: "Saved File deleted" },
    [HttpStatusCodes.NOT_FOUND]: problem,
  },
});
