import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";

import type { Auth } from "@/auth";
import { oauthGrantClaim, type OAuthGrantService } from "./oauth-grants";
import { protectedResources } from "./resources";

function scopesFromClaim(scope: unknown) {
  if (typeof scope === "string") return scope.split(" ").filter(Boolean);
  if (Array.isArray(scope) && scope.every((value) => typeof value === "string")) return scope;
  return [];
}

export function createTaskomeMcpHandler(
  auth: Auth,
  oauthGrants: OAuthGrantService,
  serverOrigin: string,
) {
  const resource = protectedResources(serverOrigin).mcp;
  const protocolHandler = createMcpHandler(
    () => new McpServer({ name: "taskome", version: "0.0.0" }),
    { legacy: "reject" },
  );

  return requireMcpAuth(
    auth,
    async (request, claims) => {
      const grantId = claims[oauthGrantClaim];
      const ownerUserId = claims.sub;
      const scopes = scopesFromClaim(claims.scope);
      if (typeof grantId !== "string" || !ownerUserId) return invalidGrantResponse(resource);
      const grant = await oauthGrants.requireActive({
        grantId,
        ownerUserId,
        requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
        resource,
        scopes,
      });
      return grant ? protocolHandler.fetch(request) : invalidGrantResponse(resource);
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
