import type { RouteHandler } from "@hono/zod-openapi";

import type { AppEnv } from "@/http/types";
import { problemDetails } from "@/http/errors/problem";
import type { ApiKeyService } from "./api-key.service";
import type {
  CreateApiKeyRoute,
  GetApiKeyRoute,
  ListApiKeysRoute,
  RevokeApiKeyRoute,
  UpdateApiKeyRoute,
} from "./api-key.routes";

function serialize(metadata: Awaited<ReturnType<ApiKeyService["get"]>> & {}) {
  return {
    ...metadata,
    createdAt: metadata.createdAt.toISOString(),
    expiresAt: metadata.expiresAt.toISOString(),
    lastUsedAt: metadata.lastUsedAt?.toISOString() ?? null,
  };
}

export function createApiKeyHandlers(service: ApiKeyService) {
  const notFound = (c: Parameters<typeof problemDetails>[0]) =>
    problemDetails(c, {
      code: "not_found",
      detail: "No API key has that identifier.",
      status: 404,
      title: "Not found",
    });
  const create: RouteHandler<CreateApiKeyRoute, AppEnv> = async (c) => {
    const body = c.req.valid("json");
    const session = c.get("session");
    const result = await service.create({
      ...body,
      ownerUserId: session.user.id,
      requestId: c.get("requestId"),
    });
    return c.json({ ...serialize(result.metadata), secret: result.secret }, 201);
  };

  const list: RouteHandler<ListApiKeysRoute, AppEnv> = async (c) => {
    const records = await service.list(c.get("session").user.id);
    return c.json(records.map(serialize), 200);
  };

  const get: RouteHandler<GetApiKeyRoute, AppEnv> = async (c) => {
    const record = await service.get(c.get("session").user.id, c.req.valid("param").id);
    if (record) return c.json(serialize(record), 200);
    return c.json(notFound(c), 404, { "content-type": "application/problem+json" });
  };

  const update: RouteHandler<UpdateApiKeyRoute, AppEnv> = async (c) => {
    const record = await service.update({
      ...c.req.valid("json"),
      id: c.req.valid("param").id,
      ownerUserId: c.get("session").user.id,
      requestId: c.get("requestId"),
    });
    if (record) return c.json(serialize(record), 200);
    return c.json(notFound(c), 404, { "content-type": "application/problem+json" });
  };

  const revoke: RouteHandler<RevokeApiKeyRoute, AppEnv> = async (c) => {
    const revoked = await service.revoke(
      c.get("session").user.id,
      c.req.valid("param").id,
      c.get("requestId"),
    );
    if (revoked) return c.body(null, 204);
    return c.json(notFound(c), 404, { "content-type": "application/problem+json" });
  };

  return { create, get, list, revoke, update };
}
