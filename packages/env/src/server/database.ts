import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const postgresUrl = z.url().refine(
  (value) => {
    const protocol = new URL(value).protocol;

    return protocol === "postgres:" || protocol === "postgresql:";
  },
  { message: "DATABASE_URL must use the postgres or postgresql protocol" },
);

export const databaseEnv = createEnv({
  server: {
    DATABASE_URL: postgresUrl,
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
