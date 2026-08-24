import { apiKey } from "@better-auth/api-key";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { APIError } from "better-auth";

import type { Database } from "@/db/database";
import * as schema from "@/db/schema";
import { createOAuthAuthorizationInputResolver } from "./oauth-authorization-input";
import { createOAuthGrantService } from "./oauth-grants";
import { protectedResources } from "./resources";
import { taskomeScopes } from "./scopes";
import { credentialManagementDenial } from "./credential-management-policy";
import { getAuthRequestCorrelation } from "./request-correlation";

export const apiKeyDefaultLifetimeSeconds = 60 * 60 * 24 * 90;
export const apiKeyMaximumLifetimeSeconds = 60 * 60 * 24 * 365;

export function createTaskomeAuthOptions(
  database: Database,
  serverOrigin: string,
  includeSchema = true,
) {
  const resources = protectedResources(serverOrigin);
  const oauthGrants = createOAuthGrantService(database);
  const resolveAuthorizationInput = createOAuthAuthorizationInputResolver();

  return {
    baseURL: serverOrigin,
    database: drizzleAdapter(database, {
      provider: "pg" as const,
      ...(includeSchema ? { schema } : {}),
    }),
    emailAndPassword: { enabled: true },
    plugins: [
      apiKey({
        customAPIKeyGetter: (context) => {
          const authorization = context.request?.headers.get("authorization");
          const match = /^Bearer (sk-[A-Za-z0-9_-]+)$/.exec(authorization ?? "");
          return match?.[1] ?? null;
        },
        defaultKeyLength: 64,
        defaultPrefix: "sk-",
        enableSessionForAPIKeys: false,
        keyExpiration: {
          defaultExpiresIn: apiKeyDefaultLifetimeSeconds,
          maxExpiresIn: apiKeyMaximumLifetimeSeconds,
          minExpiresIn: 60,
        },
        maximumPrefixLength: 3,
        minimumPrefixLength: 3,
        rateLimit: { enabled: true, maxRequests: 100, timeWindow: 60_000 },
        requireName: true,
      }),
      jwt(),
      mcp({
        accessTokenExpiresIn: 60 * 10,
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
        consentPage: "/consent",
        customAccessTokenClaims: async ({
          referenceId,
          resources: tokenResources,
          scopes,
          user,
        }) => {
          if (!referenceId || !user || tokenResources?.length !== 1) {
            throw new Error("OAuth token is missing its Taskome Grant authority");
          }
          return oauthGrants.activateAndClaim({
            grantId: referenceId,
            ownerUserId: user.id,
            resource: tokenResources[0] ?? "",
            scopes,
          });
        },
        loginPage: "/sign-in",
        postLogin: {
          consentReferenceId: async ({ scopes, user, session }) => {
            const denial = credentialManagementDenial({
              emailVerified: user.emailVerified,
              sessionCreatedAt: session.createdAt,
            });
            if (denial) {
              throw new APIError("FORBIDDEN", {
                code: denial,
                message: "Verify your email and sign in again before authorizing a client.",
              });
            }
            const input = await resolveAuthorizationInput(resources.mcp, scopes);
            return oauthGrants.createReference(user.id, input, getAuthRequestCorrelation());
          },
          page: "/oauth/select-authority",
          shouldRedirect: () => false,
        },
        refreshTokenExpiresIn: 60 * 60 * 24 * 30,
        refreshTokenReuseInterval: 30,
        resource: resources.mcp,
        scopes: ["openid", "offline_access", ...taskomeScopes],
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: "mcp-2026-07-28",
      }),
    ],
  };
}
