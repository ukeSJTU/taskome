import { env } from "@taskome/env/server";
import { betterAuth } from "better-auth";
import { testUtils, type TestHelpers } from "better-auth/plugins";

import type { Auth } from "@/auth";
import { createTaskomeAuthOptions } from "@/auth/factory";
import { db } from "@/db";

const options = createTaskomeAuthOptions(db, env.BETTER_AUTH_URL);

type TestAuth = Auth & {
  $context: Promise<Awaited<Auth["$context"]> & { test: TestHelpers }>;
};

// @ts-expect-error Better Auth's inferred API omits plugin endpoints under the 1.7.1 type conflict.
export const testAuth: TestAuth = betterAuth({
  ...options,
  // @ts-expect-error Better Auth 1.7.1 plugin metadata conflicts with TypeScript 6 exact optionals.
  plugins: [...options.plugins, testUtils()],
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CORS_ORIGIN],
});
