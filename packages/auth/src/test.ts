import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { jwt, testUtils, twoFactor } from "better-auth/plugins";

import { oauthGatewayAudience } from "./oauth-audience";

export function createTestAuth() {
  return betterAuth({
    baseURL: "http://localhost:3000",
    database: memoryAdapter({
      account: [],
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
    plugins: [
      jwt({ jwt: { audience: "http://localhost:8000/v1" } }),
      oauthProvider({
        scopes: ["openid", "profile", "email", "taskome"],
        validAudiences: ["http://localhost:8000/mcp"],
        disableJwtPlugin: false,
        loginPage: "/login",
        consentPage: "/oauth/consent",
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
      }),
      oauthGatewayAudience("http://localhost:8000/mcp"),
      twoFactor({ issuer: "taskome" }),
      testUtils({ captureOTP: true }),
    ],
    secret: "test-secret-with-at-least-thirty-two-characters",
    trustedOrigins: ["http://localhost:3000"],
  });
}
