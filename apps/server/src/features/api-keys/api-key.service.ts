import { apiKeyDefaultLifetimeSeconds, apiKeyMaximumLifetimeSeconds } from "@/auth/factory";
import { permissionsToScopes, scopePermissions, type TaskomeScope } from "@/auth/scopes";
import type { Auth } from "@/auth";
import type { Database } from "@/db/database";
import { apikey } from "@/db/schema";
import { createApiKeyRepository } from "./api-key.repository";

export interface ApiKeyMetadata {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  lastUsedAt: Date | null;
  name: string;
  scopes: TaskomeScope[];
  state: "active" | "expired" | "revoked";
}

function stateFor(record: typeof apikey.$inferSelect): ApiKeyMetadata["state"] {
  if (!record.enabled) return "revoked";
  if (!record.expiresAt || record.expiresAt <= new Date()) return "expired";
  return "active";
}

function metadataFor(record: typeof apikey.$inferSelect): ApiKeyMetadata {
  return {
    createdAt: record.createdAt,
    expiresAt: record.expiresAt ?? record.createdAt,
    id: record.id,
    lastUsedAt: record.lastRequest,
    name: record.name ?? "",
    scopes: permissionsToScopes(record.permissions ? JSON.parse(record.permissions) : undefined),
    state: stateFor(record),
  };
}

export function createApiKeyService(auth: Auth, db: Database) {
  const repository = createApiKeyRepository(db);

  return {
    async create(input: {
      expiresIn?: number | undefined;
      name: string;
      ownerUserId: string;
      requestId: string;
      scopes: TaskomeScope[];
    }) {
      const expiresIn = input.expiresIn ?? apiKeyDefaultLifetimeSeconds;
      if (expiresIn > apiKeyMaximumLifetimeSeconds) throw new RangeError("API key expiry");
      const created = await auth.api.createApiKey({
        body: {
          expiresIn,
          name: input.name,
          permissions: scopePermissions(input.scopes),
          prefix: "sk-",
          userId: input.ownerUserId,
        },
      });
      await repository.created(input.ownerUserId, created.id, input.requestId);
      return {
        metadata: {
          createdAt: created.createdAt,
          expiresAt: created.expiresAt ?? new Date(Date.now() + expiresIn * 1000),
          id: created.id,
          lastUsedAt: created.lastRequest ?? null,
          name: created.name ?? input.name,
          scopes: input.scopes,
          state: "active" as const,
        },
        secret: created.key,
      };
    },

    async get(ownerUserId: string, id: string) {
      const record = await repository.get(ownerUserId, id);
      return record ? metadataFor(record) : null;
    },

    async list(ownerUserId: string) {
      const records = await repository.list(ownerUserId);
      return records.map(metadataFor);
    },

    async revoke(ownerUserId: string, id: string, requestId: string) {
      return repository.revoke(ownerUserId, id, requestId);
    },

    async update(input: {
      expiresIn?: number | undefined;
      id: string;
      name?: string | undefined;
      ownerUserId: string;
      requestId: string;
      scopes?: TaskomeScope[] | undefined;
    }) {
      const record = await repository.get(input.ownerUserId, input.id);
      if (!record) return null;
      if (input.expiresIn && input.expiresIn > apiKeyMaximumLifetimeSeconds) {
        throw new RangeError("API key expiry");
      }
      const expiresAt = input.expiresIn
        ? new Date(Date.now() + input.expiresIn * 1000)
        : record.expiresAt;
      const permissions = input.scopes
        ? JSON.stringify(scopePermissions(input.scopes))
        : record.permissions;
      const updated = await repository.update({
        expiresAt,
        id: input.id,
        name: input.name ?? record.name,
        ownerUserId: input.ownerUserId,
        permissions,
        requestId: input.requestId,
        scopes: input.scopes ?? [],
        scopesChanged: Boolean(input.scopes),
      });
      return updated ? metadataFor(updated) : null;
    },
  };
}

export type ApiKeyService = ReturnType<typeof createApiKeyService>;
