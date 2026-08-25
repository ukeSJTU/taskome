import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { databaseEnv } from "./server/database";

export const env = createEnv({
  extends: [databaseEnv],
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    OBJECT_STORAGE_ENDPOINT: z.url().default("http://localhost:8333"),
    OBJECT_STORAGE_BUCKET: z.string().min(1).default("taskome-dev"),
    OBJECT_STORAGE_ACCESS_KEY_ID: z.string().min(1).default("taskome-development"),
    OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).default("taskome-development-only-secret"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
