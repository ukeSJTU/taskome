import { env } from "@taskome/env/server";
import { betterAuth } from "better-auth";

import { createTaskomeAuthOptions } from "@/auth/factory";
import { db } from "@/db";

const { database: _database, ...options } = createTaskomeAuthOptions(
  db,
  env.BETTER_AUTH_URL,
  false,
);

// @ts-expect-error Better Auth 1.7.1's MCP OpenAPI metadata is narrower than its core plugin type.
export const auth = betterAuth({
  ...options,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CORS_ORIGIN],
});
