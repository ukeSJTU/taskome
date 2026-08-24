import { and, desc, eq } from "drizzle-orm";

import type { Database } from "@/db/database";
import {
  oauthAccessToken,
  oauthConsent,
  oauthGrant,
  oauthRefreshToken,
  securityEvent,
} from "@/db/schema";

export function createOAuthGrantManagementService(db: Database) {
  async function owned(ownerUserId: string, id: string) {
    const [grant] = await db
      .select()
      .from(oauthGrant)
      .where(and(eq(oauthGrant.id, id), eq(oauthGrant.ownerUserId, ownerUserId)));
    return grant;
  }

  return {
    get: owned,
    async list(ownerUserId: string) {
      return db
        .select()
        .from(oauthGrant)
        .where(eq(oauthGrant.ownerUserId, ownerUserId))
        .orderBy(desc(oauthGrant.createdAt));
    },
    revoke: (ownerUserId: string, id: string, requestId: string) =>
      db.transaction(async (transaction) => {
        const [grant] = await transaction
          .select()
          .from(oauthGrant)
          .where(and(eq(oauthGrant.id, id), eq(oauthGrant.ownerUserId, ownerUserId)));
        if (!grant) return false;
        const revokedAt = new Date();
        await transaction
          .update(oauthGrant)
          .set({ revokedAt, state: "revoked", updatedAt: revokedAt })
          .where(eq(oauthGrant.id, id));
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
      }),
  };
}

export type OAuthGrantManagementService = ReturnType<typeof createOAuthGrantManagementService>;
