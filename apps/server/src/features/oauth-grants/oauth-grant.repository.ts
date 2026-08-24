import { and, desc, eq, ne } from "drizzle-orm";

import type { Database } from "@/db/database";
import {
  oauthAccessToken,
  oauthConsent,
  oauthGrant,
  oauthRefreshToken,
  securityEvent,
} from "@/db/schema";

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
        await transaction
          .update(oauthRefreshToken)
          .set({
            revoked: revokedAt,
            rotationReplayExpiresAt: null,
            rotationReplayResponse: null,
          })
          .where(eq(oauthRefreshToken.referenceId, id));
        await transaction
          .update(oauthAccessToken)
          .set({ revoked: revokedAt })
          .where(eq(oauthAccessToken.referenceId, id));
        await transaction.delete(oauthConsent).where(eq(oauthConsent.referenceId, id));
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
