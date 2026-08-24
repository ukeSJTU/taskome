import type { RouteHandler } from "@hono/zod-openapi";

import type { AppEnv } from "@/http/types";
import { parseTaskomeScopes } from "@/auth/scopes";
import type { OAuthGrantManagementService } from "./oauth-grant.service";
import type {
  GetOAuthGrantRoute,
  ListOAuthGrantsRoute,
  RevokeOAuthGrantRoute,
} from "./oauth-grant.routes";

type Grant = NonNullable<Awaited<ReturnType<OAuthGrantManagementService["get"]>>>;

function serialize(grant: Grant) {
  return {
    ...grant,
    activatedAt: grant.activatedAt?.toISOString() ?? null,
    createdAt: grant.createdAt.toISOString(),
    expiresAt: grant.expiresAt.toISOString(),
    lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    scopes: parseTaskomeScopes(grant.scopes),
  };
}

function notFound(c: { get: (key: "requestId") => string; req: { path: string } }) {
  return {
    code: "not_found",
    detail: "No OAuth Grant has that identifier.",
    instance: c.req.path,
    requestId: c.get("requestId"),
    status: 404 as const,
    title: "Not found",
    type: "about:blank",
  };
}

export function createOAuthGrantHandlers(service: OAuthGrantManagementService) {
  const list: RouteHandler<ListOAuthGrantsRoute, AppEnv> = async (c) =>
    c.json((await service.list(c.get("session").user.id)).map(serialize), 200);
  const get: RouteHandler<GetOAuthGrantRoute, AppEnv> = async (c) => {
    const grant = await service.get(c.get("session").user.id, c.req.valid("param").id);
    return grant ? c.json(serialize(grant), 200) : c.json(notFound(c), 404);
  };
  const revoke: RouteHandler<RevokeOAuthGrantRoute, AppEnv> = async (c) => {
    const done = await service.revoke(
      c.get("session").user.id,
      c.req.valid("param").id,
      c.get("requestId"),
    );
    return done ? c.body(null, 204) : c.json(notFound(c), 404);
  };
  return { get, list, revoke };
}
