import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { jwt, testUtils, twoFactor } from "better-auth/plugins";

import { oauthGatewayAudience } from "./oauth-audience";
import { authI18nPlugin } from "./i18n";
import { mcpOAuthProvider } from "./mcp-oauth";
import { enforcePersonalApiKeyLifecycle, personalApiKeyPlugin } from "./personal-api-keys";

export function createTestAuth() {
  return betterAuth({
    baseURL: "http://localhost:3000",
    database: memoryAdapter({
      account: [],
      apikey: [],
      jwks: [],
      oauthAccessToken: [],
      oauthClient: [],
      oauthConsent: [],
      oauthRefreshToken: [],
      session: [],
      twoFactor: [],
      user: [],
      verification: [],
    }),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: true },
    hooks: { before: enforcePersonalApiKeyLifecycle },
    plugins: [
      personalApiKeyPlugin(),
      jwt({ jwt: { audience: "http://localhost:8000/v1" } }),
      mcpOAuthProvider("http://localhost:8000/mcp"),
      oauthGatewayAudience("http://localhost:8000/mcp"),
      twoFactor({ issuer: "taskome" }),
      authI18nPlugin(),
      testUtils({ captureOTP: true }),
    ],
    secret: "test-secret-with-at-least-thirty-two-characters",
    trustedOrigins: ["http://localhost:3000"],
  });
}
