import { and, desc, eq } from "drizzle-orm";

import type { Database } from "@/db/database";
import { apikey, securityEvent } from "@/db/schema";

export function createApiKeyRepository(db: Database) {
  return {
    async get(ownerUserId: string, id: string) {
      const [record] = await db
        .select()
        .from(apikey)
        .where(and(eq(apikey.id, id), eq(apikey.referenceId, ownerUserId)));
      return record;
    },
    list(ownerUserId: string) {
      return db
        .select()
        .from(apikey)
        .where(eq(apikey.referenceId, ownerUserId))
        .orderBy(desc(apikey.createdAt));
    },
    revoke(ownerUserId: string, id: string, requestId: string) {
      return db.transaction(async (transaction) => {
        const [record] = await transaction
          .select({ id: apikey.id })
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
    update(input: {
      expiresAt: Date | null;
      id: string;
      name: string | null;
      ownerUserId: string;
      permissions: string | null;
      requestId: string;
      scopesChanged: boolean;
      scopes: string[];
    }) {
      return db.transaction(async (transaction) => {
        const [updated] = await transaction
          .update(apikey)
          .set({
            expiresAt: input.expiresAt,
            name: input.name,
            permissions: input.permissions,
            updatedAt: new Date(),
          })
          .where(and(eq(apikey.id, input.id), eq(apikey.referenceId, input.ownerUserId)))
          .returning();
        if (!updated) return null;
        if (input.scopesChanged) {
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
        return updated;
      });
    },
  };
}
