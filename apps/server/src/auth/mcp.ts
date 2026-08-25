import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";

import type { Auth } from "@/auth";
import { oauthGrantClaim, type OAuthGrantService } from "./oauth-grants";
import { protectedResources } from "./resources";
import type { SecurityContext } from "./security-context";
import { parseTaskomeScopes } from "./scopes";
import { registerSavedFileTools, type SavedFilesModule } from "@/features/saved-files";

function scopesFromClaim(scope: unknown) {
  if (typeof scope === "string") return scope.split(" ").filter(Boolean);
  if (Array.isArray(scope) && scope.every((value) => typeof value === "string")) return scope;
  return [];
}

export function createTaskomeMcpHandler(
  auth: Auth,
  oauthGrants: OAuthGrantService,
  serverOrigin: string,
  savedFiles: SavedFilesModule,
) {
  const resource = protectedResources(serverOrigin).mcp;
  const protocolHandler = createMcpHandler(
    () => {
      const server = new McpServer({ name: "taskome", version: "0.0.0" });
      registerSavedFileTools(server, savedFiles);
      return server;
    },
    { legacy: "reject" },
  );

  return requireMcpAuth(
    auth,
    async (request, claims) => {
      const grantId = claims[oauthGrantClaim];
      const ownerUserId = claims.sub;
      const clientId = claims.client_id;
      const scopes = scopesFromClaim(claims.scope);
      if (typeof grantId !== "string" || !ownerUserId || typeof clientId !== "string") {
        return invalidGrantResponse(resource);
      }
      const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
      const grant = await oauthGrants.requireActive({
        grantId,
        ownerUserId,
        requestId,
        resource,
        scopes,
      });
      if (!grant) return invalidGrantResponse(resource);
      const securityContext: SecurityContext = {
        correlation: { requestId },
        credential: { grantId, type: "oauth_grant" },
        resource,
        scopes: parseTaskomeScopes(grant.scopes),
        user: {
          emailVerified: claims.email_verified === true,
          id: ownerUserId,
        },
      };
      const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      return protocolHandler.fetch(request, {
        authInfo: {
          clientId,
          ...(typeof claims.exp === "number" ? { expiresAt: claims.exp } : {}),
          extra: { securityContext },
          resource: new URL(resource),
          scopes,
          token,
        },
      });
    },
    {
      challengeScopes: ["taskome:access"],
      requiredScopes: ["taskome:access"],
      resource,
    },
  );
}

function invalidGrantResponse(resource: string) {
  const metadata = new URL("/.well-known/oauth-protected-resource/mcp", resource).toString();
  return new Response(
    JSON.stringify({
      error: { code: -32_000, message: "OAuth Grant is inactive" },
      id: null,
      jsonrpc: "2.0",
    }),
    {
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer error="invalid_token", resource_metadata="${metadata}"`,
      },
      status: 401,
    },
  );
}
