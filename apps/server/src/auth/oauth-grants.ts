import { and, eq, lt } from "drizzle-orm";

import type { Database } from "@/db/database";
import {
  oauthAccessToken,
  oauthConsent,
  oauthGrant,
  oauthRefreshToken,
  securityEvent,
} from "@/db/schema";
import type { OAuthAuthorizationInput } from "./oauth-authorization-input";
import { parseTaskomeScopes } from "./scopes";

export const oauthGrantLifetimeSeconds = 60 * 60 * 24 * 90;
export const oauthGrantClaim = "https://taskome.xdenovo.com/claims/oauth-grant-id";

function sameScopes(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((scope, index) => scope === right[index]);
}

export function createOAuthGrantService(db: Database) {
  return {
    async activateAndClaim(input: {
      grantId: string;
      ownerUserId: string;
      resource: string;
      scopes: readonly string[];
    }) {
      const scopes = parseTaskomeScopes(
        input.scopes.filter((scope) => scope.startsWith("taskome:")),
      );
      const [grant] = await db.select().from(oauthGrant).where(eq(oauthGrant.id, input.grantId));
      if (
        !grant ||
        grant.ownerUserId !== input.ownerUserId ||
        grant.resource !== input.resource ||
        !sameScopes(grant.scopes, scopes) ||
        grant.state === "revoked" ||
        grant.expiresAt <= new Date()
      ) {
        throw new Error("OAuth Grant is not authoritative for this token");
      }

      if (grant.state === "pending") {
        await db
          .update(oauthGrant)
          .set({ activatedAt: new Date(), state: "active", updatedAt: new Date() })
          .where(and(eq(oauthGrant.id, grant.id), eq(oauthGrant.state, "pending")));
      }

      return { [oauthGrantClaim]: grant.id };
    },

    async createReference(ownerUserId: string, input: OAuthAuthorizationInput, requestId: string) {
      const now = new Date();
      await db
        .delete(oauthGrant)
        .where(
          and(
            eq(oauthGrant.state, "pending"),
            lt(oauthGrant.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
          ),
        );

      const existing = await db
        .select()
        .from(oauthGrant)
        .where(
          and(
            eq(oauthGrant.ownerUserId, ownerUserId),
            eq(oauthGrant.clientId, input.clientId),
            eq(oauthGrant.resource, input.resource),
          ),
        );
      const reusable = existing.find(
        (grant) =>
          grant.state !== "revoked" &&
          grant.expiresAt > now &&
          sameScopes(grant.scopes, input.scopes),
      );
      if (reusable) return reusable.id;

      const id = crypto.randomUUID();
      await db.transaction(async (transaction) => {
        const superseded = existing.filter((grant) => grant.state === "active");
        for (const grant of superseded) {
          await transaction
            .update(oauthGrant)
            .set({ revokedAt: now, state: "revoked", updatedAt: now })
            .where(eq(oauthGrant.id, grant.id));
          await transaction
            .update(oauthRefreshToken)
            .set({
              revoked: now,
              rotationReplayExpiresAt: null,
              rotationReplayResponse: null,
            })
            .where(eq(oauthRefreshToken.referenceId, grant.id));
          await transaction
            .update(oauthAccessToken)
            .set({ revoked: now })
            .where(eq(oauthAccessToken.referenceId, grant.id));
          await transaction.delete(oauthConsent).where(eq(oauthConsent.referenceId, grant.id));
          await transaction.insert(securityEvent).values({
            actorUserId: ownerUserId,
            details: { scopes: input.scopes },
            grantId: grant.id,
            id: crypto.randomUUID(),
            operation: "oauth_grant.scopes_changed",
            requestId,
            result: "succeeded",
            targetId: id,
            targetType: "oauth_grant",
          });
        }
        await transaction.insert(oauthGrant).values({
          clientId: input.clientId,
          expiresAt: new Date(now.getTime() + oauthGrantLifetimeSeconds * 1000),
          id,
          ownerUserId,
          resource: input.resource,
          scopes: input.scopes,
        });
        await transaction.insert(securityEvent).values({
          actorUserId: ownerUserId,
          grantId: id,
          id: crypto.randomUUID(),
          operation: "oauth_grant.created",
          requestId,
          result: "succeeded",
          targetId: id,
          targetType: "oauth_grant",
        });
      });
      return id;
    },

    async requireActive(input: {
      grantId: string;
      ownerUserId: string;
      resource: string;
      scopes: readonly string[];
      requestId: string;
    }) {
      const [grant] = await db.select().from(oauthGrant).where(eq(oauthGrant.id, input.grantId));
      if (
        !grant ||
        grant.state !== "active" ||
        grant.ownerUserId !== input.ownerUserId ||
        grant.resource !== input.resource ||
        !sameScopes(
          grant.scopes,
          parseTaskomeScopes(input.scopes.filter((scope) => scope.startsWith("taskome:"))),
        ) ||
        grant.expiresAt <= new Date()
      ) {
        await db.insert(securityEvent).values({
          actorUserId: grant?.ownerUserId,
          grantId: grant?.id,
          id: crypto.randomUUID(),
          operation:
            grant && grant.expiresAt <= new Date() ? "oauth_grant.expired" : "oauth_grant.denied",
          requestId: input.requestId,
          result: "denied",
          targetId: input.grantId,
          targetType: "oauth_grant",
        });
        return null;
      }

      await db.transaction(async (transaction) => {
        await transaction
          .update(oauthGrant)
          .set({ lastUsedAt: new Date(), updatedAt: new Date() })
          .where(eq(oauthGrant.id, grant.id));
        await transaction.insert(securityEvent).values({
          actorUserId: grant.ownerUserId,
          grantId: grant.id,
          id: crypto.randomUUID(),
          operation: "oauth_grant.used",
          requestId: input.requestId,
          result: "succeeded",
          targetId: grant.id,
          targetType: "oauth_grant",
        });
      });
      return grant;
    },
  };
}

export type OAuthGrantService = ReturnType<typeof createOAuthGrantService>;
