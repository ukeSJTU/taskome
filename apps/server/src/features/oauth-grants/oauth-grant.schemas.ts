import { z } from "@hono/zod-openapi";

import { taskomeScopes } from "@/auth/scopes";

export const OAuthGrantSchema = z
  .object({
    activatedAt: z.iso.datetime().nullable(),
    clientId: z.string(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    id: z.string(),
    lastUsedAt: z.iso.datetime().nullable(),
    resource: z.url(),
    revokedAt: z.iso.datetime().nullable(),
    scopes: z.array(z.enum(taskomeScopes)),
    state: z.enum(["pending", "active", "revoked"]),
  })
  .openapi("OAuthGrant");
