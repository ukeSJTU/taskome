import { createDb } from "@taskome/db";
import * as schema from "@taskome/db/schema/auth";
import { env } from "@taskome/env/server";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { jwt, twoFactor } from "better-auth/plugins";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [
      jwt(),
      oauthProvider({
        scopes: ["openid", "profile", "email", "taskome"],
        validAudiences: [env.GATEWAY_URL],
        disableJwtPlugin: false,
        loginPage: "/login",
        consentPage: "/oauth/consent",
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
      }),
      twoFactor({ issuer: "taskome" }),
      nextCookies(),
    ],
  });
}

export const auth = createAuth();
