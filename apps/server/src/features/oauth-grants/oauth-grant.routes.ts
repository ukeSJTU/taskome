import { createRoute, z } from "@hono/zod-openapi";
import jsonContent from "stoker/openapi/helpers/json-content";

import { ProblemDetailsSchema } from "@/http/errors/problem";
import { OAuthGrantSchema } from "./oauth-grant.schemas";

const problem = {
  content: { "application/problem+json": { schema: ProblemDetailsSchema } },
  description: "The request could not be completed",
};
const params = z.object({ id: z.string().min(1) });

export const listOAuthGrantsRoute = createRoute({
  description: "List the signed-in user's OAuth Grant history.",
  method: "get",
  operationId: "listOAuthGrants",
  path: "/oauth-grants",
  responses: { 200: jsonContent(z.array(OAuthGrantSchema), "OAuth Grants"), 403: problem },
  security: [{ cookieAuth: [] }],
  tags: ["Programmatic access"],
});
export const getOAuthGrantRoute = createRoute({
  description: "Inspect one OAuth Grant.",
  method: "get",
  operationId: "getOAuthGrant",
  path: "/oauth-grants/{id}",
  request: { params },
  responses: { 200: jsonContent(OAuthGrantSchema, "OAuth Grant"), 404: problem },
  security: [{ cookieAuth: [] }],
  tags: ["Programmatic access"],
});
export const revokeOAuthGrantRoute = createRoute({
  description: "Revoke a Grant and its complete OAuth token family.",
  method: "delete",
  operationId: "revokeOAuthGrant",
  path: "/oauth-grants/{id}",
  request: { params },
  responses: { 204: { description: "OAuth Grant revoked" }, 404: problem },
  security: [{ cookieAuth: [] }],
  tags: ["Programmatic access"],
});

export type GetOAuthGrantRoute = typeof getOAuthGrantRoute;
export type ListOAuthGrantsRoute = typeof listOAuthGrantsRoute;
export type RevokeOAuthGrantRoute = typeof revokeOAuthGrantRoute;
