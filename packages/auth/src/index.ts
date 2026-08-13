import { createDb } from "@taskome/db";
import * as schema from "@taskome/db/schema/auth";
import { env } from "@taskome/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { jwt, twoFactor } from "better-auth/plugins";

import { oauthGatewayAudience } from "./oauth-audience";
import { mcpOAuthProvider } from "./mcp-oauth";
import { enforcePersonalApiKeyLifecycle, personalApiKeyPlugin } from "./personal-api-keys";

export function createAuth() {
  const db = createDb();
  const gatewayRESTResource = new URL("/v1", env.GATEWAY_PUBLIC_URL).toString();
  const gatewayMCPResource = new URL("/mcp", env.GATEWAY_PUBLIC_URL).toString();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: [env.AUTH_TRUSTED_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    hooks: { before: enforcePersonalApiKeyLifecycle },
    plugins: [
      personalApiKeyPlugin(),
      jwt({ jwt: { audience: gatewayRESTResource } }),
      mcpOAuthProvider(gatewayMCPResource),
      oauthGatewayAudience(gatewayMCPResource),
      twoFactor({ issuer: "taskome" }),
      nextCookies(),
    ],
  });
}

export const auth = createAuth();
