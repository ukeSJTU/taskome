import { z } from "@hono/zod-openapi";

import { apiKeyMaximumLifetimeSeconds } from "@/auth/factory";
import { taskomeScopes } from "@/auth/scopes";

export const ApiKeyMetadataSchema = z
  .object({
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    id: z.string(),
    lastUsedAt: z.iso.datetime().nullable(),
    name: z.string(),
    scopes: z.array(z.enum(taskomeScopes)),
    state: z.enum(["active", "expired", "revoked"]),
  })
  .openapi("ApiKeyMetadata");

export const CreateApiKeySchema = z
  .object({
    expiresIn: z.number().int().positive().max(apiKeyMaximumLifetimeSeconds).optional(),
    name: z.string().trim().min(1).max(100),
    scopes: z.array(z.enum(taskomeScopes)).min(1),
  })
  .openapi("CreateApiKey");

export const CreatedApiKeySchema = ApiKeyMetadataSchema.extend({
  secret: z.string().startsWith("sk-"),
}).openapi("CreatedApiKey");

export const UpdateApiKeySchema = z
  .object({
    expiresIn: z.number().int().positive().max(apiKeyMaximumLifetimeSeconds).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    scopes: z.array(z.enum(taskomeScopes)).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one change is required")
  .openapi("UpdateApiKey");
