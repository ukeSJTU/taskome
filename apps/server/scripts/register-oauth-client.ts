import { env } from "@taskome/env/server";

import { registerNativeOAuthClient } from "../src/auth/oauth-client-registration";
import { protectedResources } from "../src/auth/resources";
import { database } from "../src/db";

const [clientName, ...redirectUris] = process.argv.slice(2);

if (!clientName || redirectUris.length === 0) {
  throw new Error("Usage: pnpm run oauth:register-client -- <client-name> <redirect-uri> [...]");
}
for (const redirectUri of redirectUris) new URL(redirectUri);

try {
  const clientId = await registerNativeOAuthClient(database.db, {
    name: clientName,
    redirectUris,
    resource: protectedResources(env.BETTER_AUTH_URL).mcp,
  });
  process.stdout.write(`${clientId}\n`);
} finally {
  await database.close();
}
