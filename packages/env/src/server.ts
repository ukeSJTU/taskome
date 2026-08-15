import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    WEB_PUBLIC_URL: z.url().default("http://localhost:3000"),
    GATEWAY_PUBLIC_URL: z.url().default("http://localhost:8000"),
    GATEWAY_INTERNAL_URL: z.url().default("http://localhost:8000"),
    WEB_GATEWAY_HMAC_SECRET: z.string().min(32),
    AUTH_TRUSTED_ORIGIN: z.url(),
    E2E_DISABLE_AUTH_RATE_LIMIT: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
