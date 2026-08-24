import { and, desc, eq } from "drizzle-orm";

import { apiKeyDefaultLifetimeSeconds, apiKeyMaximumLifetimeSeconds } from "@/auth/factory";
import { permissionsToScopes, scopePermissions, type TaskomeScope } from "@/auth/scopes";
import type { Auth } from "@/auth";
import type { Database } from "@/db/database";
import { apikey, securityEvent } from "@/db/schema";

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
  async function ownedRecord(ownerUserId: string, id: string) {
    const [record] = await db
      .select()
      .from(apikey)
      .where(and(eq(apikey.id, id), eq(apikey.referenceId, ownerUserId)));
    return record;
  }

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
      await db.insert(securityEvent).values({
        actorUserId: input.ownerUserId,
        credentialId: created.id,
        id: crypto.randomUUID(),
        operation: "api_key.created",
        requestId: input.requestId,
        result: "succeeded",
        targetId: created.id,
        targetType: "api_key",
      });
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
      const record = await ownedRecord(ownerUserId, id);
      return record ? metadataFor(record) : null;
    },

    async list(ownerUserId: string) {
      const records = await db
        .select()
        .from(apikey)
        .where(eq(apikey.referenceId, ownerUserId))
        .orderBy(desc(apikey.createdAt));
      return records.map(metadataFor);
    },

    async revoke(ownerUserId: string, id: string, requestId: string) {
      return db.transaction(async (transaction) => {
        const [record] = await transaction
          .select()
          .from(apikey)
          .where(and(eq(apikey.id, id), eq(apikey.referenceId, ownerUserId)));
        if (!record) return false;
        await transaction.update(apikey).set({ enabled: false }).where(eq(apikey.id, id));
        await transaction.insert(securityEvent).values({
          actorUserId: ownerUserId,
          credentialId: id,
          id: crypto.randomUUID(),
          operation: "api_key.revoked",
          requestId,
          result: "succeeded",
          targetId: id,
          targetType: "api_key",
        });
        return true;
      });
    },

    async update(input: {
      expiresIn?: number | undefined;
      id: string;
      name?: string | undefined;
      ownerUserId: string;
      requestId: string;
      scopes?: TaskomeScope[] | undefined;
    }) {
      return db.transaction(async (transaction) => {
        const [record] = await transaction
          .select()
          .from(apikey)
          .where(and(eq(apikey.id, input.id), eq(apikey.referenceId, input.ownerUserId)));
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
        const [updated] = await transaction
          .update(apikey)
          .set({ expiresAt, name: input.name ?? record.name, permissions, updatedAt: new Date() })
          .where(eq(apikey.id, input.id))
          .returning();
        if (input.scopes) {
          await transaction.insert(securityEvent).values({
            actorUserId: input.ownerUserId,
            credentialId: input.id,
            details: { scopes: input.scopes },
            id: crypto.randomUUID(),
            operation: "api_key.scopes_changed",
            requestId: input.requestId,
            result: "succeeded",
            targetId: input.id,
            targetType: "api_key",
          });
        }
        return updated ? metadataFor(updated) : null;
      });
    },
  };
}

export type ApiKeyService = ReturnType<typeof createApiKeyService>;
