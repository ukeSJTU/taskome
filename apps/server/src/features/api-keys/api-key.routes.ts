import { createRoute, z } from "@hono/zod-openapi";
import jsonContent from "stoker/openapi/helpers/json-content";

import { ProblemDetailsSchema } from "@/http/errors/problem";
import {
  ApiKeyMetadataSchema,
  CreatedApiKeySchema,
  CreateApiKeySchema,
  UpdateApiKeySchema,
} from "./api-key.schemas";

const problem = {
  content: { "application/problem+json": { schema: ProblemDetailsSchema } },
  description: "The request could not be completed",
};
const idParameter = z.object({ id: z.string().min(1) });

export const createApiKeyRoute = createRoute({
  description: "Create a scoped API key and return its secret once.",
  method: "post",
  operationId: "createApiKey",
  path: "/api-keys",
  request: { body: { content: { "application/json": { schema: CreateApiKeySchema } } } },
  responses: {
    201: jsonContent(CreatedApiKeySchema, "Created API key"),
    403: problem,
    422: problem,
  },
  security: [{ cookieAuth: [] }],
  tags: ["Programmatic access"],
});

export const listApiKeysRoute = createRoute({
  description: "List the signed-in user's API-key history.",
  method: "get",
  operationId: "listApiKeys",
  path: "/api-keys",
  responses: { 200: jsonContent(z.array(ApiKeyMetadataSchema), "API keys"), 403: problem },
  security: [{ cookieAuth: [] }],
  tags: ["Programmatic access"],
});

export const getApiKeyRoute = createRoute({
  description: "Inspect API-key metadata without exposing secret material.",
  method: "get",
  operationId: "getApiKey",
  path: "/api-keys/{id}",
  request: { params: idParameter },
  responses: { 200: jsonContent(ApiKeyMetadataSchema, "API key"), 404: problem },
  security: [{ cookieAuth: [] }],
  tags: ["Programmatic access"],
});

export const updateApiKeyRoute = createRoute({
  description: "Update an API key within Taskome's policy.",
  method: "patch",
  operationId: "updateApiKey",
  path: "/api-keys/{id}",
  request: {
    body: { content: { "application/json": { schema: UpdateApiKeySchema } } },
    params: idParameter,
  },
  responses: {
    200: jsonContent(ApiKeyMetadataSchema, "Updated API key"),
    404: problem,
    422: problem,
  },
  security: [{ cookieAuth: [] }],
  tags: ["Programmatic access"],
});

export const revokeApiKeyRoute = createRoute({
  description: "Revoke an API key while retaining its safe metadata.",
  method: "delete",
  operationId: "revokeApiKey",
  path: "/api-keys/{id}",
  request: { params: idParameter },
  responses: { 204: { description: "API key revoked" }, 404: problem },
  security: [{ cookieAuth: [] }],
  tags: ["Programmatic access"],
});

export type CreateApiKeyRoute = typeof createApiKeyRoute;
export type GetApiKeyRoute = typeof getApiKeyRoute;
export type ListApiKeysRoute = typeof listApiKeysRoute;
export type RevokeApiKeyRoute = typeof revokeApiKeyRoute;
export type UpdateApiKeyRoute = typeof updateApiKeyRoute;
