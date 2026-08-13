import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { jwt, testUtils, twoFactor } from "better-auth/plugins";

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
      jwt(),
      oauthProvider({
        scopes: ["openid", "profile", "email", "taskome"],
        disableJwtPlugin: false,
        loginPage: "/login",
        consentPage: "/oauth/consent",
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
      }),
      twoFactor({ issuer: "taskome" }),
      testUtils({ captureOTP: true }),
    ],
    secret: "test-secret-with-at-least-thirty-two-characters",
    trustedOrigins: ["http://localhost:3000"],
  });
}
