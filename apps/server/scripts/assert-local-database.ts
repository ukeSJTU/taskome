import { databaseEnv } from "@taskome/env/server/database";

const mode = process.argv[2];

if (mode !== "local" && mode !== "compose") {
  console.error("Usage: assert-local-database.ts <local|compose>");
  process.exit(2);
}

const databaseUrl = new URL(databaseEnv.DATABASE_URL);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const isLoopback = loopbackHosts.has(databaseUrl.hostname);

if (!isLoopback) {
  console.error("Refusing database operation: DATABASE_URL must use a loopback host.");
  process.exit(1);
}

if (mode === "compose") {
  const port = databaseUrl.port || "5432";
  const database = decodeURIComponent(databaseUrl.pathname.slice(1));
  const username = decodeURIComponent(databaseUrl.username);
  const password = decodeURIComponent(databaseUrl.password);
  const isComposeDatabase =
    port === "5432" && database === "taskome" && username === "taskome" && password === "taskome";

  if (!isComposeDatabase) {
    console.error(
      "Refusing database operation: use the local Compose DATABASE_URL from apps/server/.env.example.",
    );
    process.exit(1);
  }
}
