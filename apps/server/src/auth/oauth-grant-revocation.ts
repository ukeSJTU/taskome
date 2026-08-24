import { eq } from "drizzle-orm";

import type { Database } from "@/db/database";
import { oauthAccessToken, oauthConsent, oauthRefreshToken } from "@/db/schema";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function revokeOAuthGrantTokenFamily(
  transaction: Transaction,
  grantId: string,
  revokedAt: Date,
) {
  await transaction
    .update(oauthRefreshToken)
    .set({
      revoked: revokedAt,
      rotationReplayExpiresAt: null,
      rotationReplayResponse: null,
    })
    .where(eq(oauthRefreshToken.referenceId, grantId));
  await transaction
    .update(oauthAccessToken)
    .set({ revoked: revokedAt })
    .where(eq(oauthAccessToken.referenceId, grantId));
  await transaction.delete(oauthConsent).where(eq(oauthConsent.referenceId, grantId));
}
