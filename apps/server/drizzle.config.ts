import { databaseEnv } from "@taskome/env/server/database";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseEnv.DATABASE_URL,
  },
});
