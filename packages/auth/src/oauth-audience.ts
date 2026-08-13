import type { BetterAuthPlugin } from "better-auth";

const OAUTH_TOKEN_PATH = "/oauth2/token";

/**
 * Better Auth 1.6.x only signs OAuth access tokens as JWTs when an audience is
 * present. Keep that implementation detail inside the auth package so OAuth
 * clients do not need to opt into RFC 8707 resource binding themselves.
 */
export function oauthGatewayAudience(audience: string): BetterAuthPlugin {
  return {
    id: "oauth-gateway-audience",
    onRequest: async (request) => {
      const url = new URL(request.url);
      if (
        request.method !== "POST" ||
        !url.pathname.endsWith(OAUTH_TOKEN_PATH) ||
        !request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")
      ) {
        return;
      }

      const body = new URLSearchParams(await request.clone().text());
      body.set("resource", audience);
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      return { request: new Request(request, { body, headers, method: "POST" }) };
    },
  };
}
