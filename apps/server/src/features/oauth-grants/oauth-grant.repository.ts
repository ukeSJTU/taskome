import { and, desc, eq, ne } from "drizzle-orm";

import type { Database } from "@/db/database";
import { oauthGrant, securityEvent } from "@/db/schema";
import { revokeOAuthGrantTokenFamily } from "@/auth/oauth-grant-revocation";

export function createOAuthGrantRepository(db: Database) {
  return {
    async get(ownerUserId: string, id: string) {
      const [grant] = await db
        .select()
        .from(oauthGrant)
        .where(and(eq(oauthGrant.id, id), eq(oauthGrant.ownerUserId, ownerUserId)));
      return grant;
    },
    async list(ownerUserId: string) {
      return await db
        .select()
        .from(oauthGrant)
        .where(eq(oauthGrant.ownerUserId, ownerUserId))
        .orderBy(desc(oauthGrant.createdAt));
    },
    revoke(ownerUserId: string, id: string, requestId: string) {
      return db.transaction(async (transaction) => {
        const revokedAt = new Date();
        const [revokedGrant] = await transaction
          .update(oauthGrant)
          .set({ revokedAt, state: "revoked", updatedAt: revokedAt })
          .where(
            and(
              eq(oauthGrant.id, id),
              eq(oauthGrant.ownerUserId, ownerUserId),
              ne(oauthGrant.state, "revoked"),
            ),
          )
          .returning({ id: oauthGrant.id });
        if (!revokedGrant) {
          const [ownedGrant] = await transaction
            .select({ id: oauthGrant.id })
            .from(oauthGrant)
            .where(and(eq(oauthGrant.id, id), eq(oauthGrant.ownerUserId, ownerUserId)));
          return Boolean(ownedGrant);
        }
        await revokeOAuthGrantTokenFamily(transaction, id, revokedAt);
        await transaction.insert(securityEvent).values({
          actorUserId: ownerUserId,
          grantId: id,
          id: crypto.randomUUID(),
          operation: "oauth_grant.revoked",
          requestId,
          result: "succeeded",
          targetId: id,
          targetType: "oauth_grant",
        });
        return true;
      });
    },
  };
}
