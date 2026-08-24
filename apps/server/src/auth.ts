import { env } from "@taskome/env/server";
import type { ApiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";

import { createTaskomeAuthOptions } from "@/auth/factory";
import { db } from "@/db";

interface TaskomeAuthApi {
  api: {
    createApiKey(input: {
      body: {
        expiresIn: number;
        name: string;
        permissions: Record<string, string[]>;
        prefix: string;
        userId: string;
      };
    }): Promise<ApiKey>;
    verifyApiKey(input: { body: { key: string } }): Promise<{
      error: null | { code: string; message: string };
      key: null | Omit<ApiKey, "key">;
      valid: boolean;
    }>;
  };
}

// @ts-expect-error Better Auth 1.7.1's MCP metadata is narrower than its core plugin type.
export const auth: ReturnType<typeof betterAuth> & TaskomeAuthApi = betterAuth({
  ...createTaskomeAuthOptions(db, env.BETTER_AUTH_URL),
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CORS_ORIGIN],
});

export type Auth = typeof auth;
