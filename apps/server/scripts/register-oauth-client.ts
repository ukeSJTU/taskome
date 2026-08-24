import { auth } from "../src/auth";
import { database } from "../src/db";

const [clientName, ...redirectUris] = process.argv.slice(2);

if (!clientName || redirectUris.length === 0) {
  throw new Error("Usage: pnpm run oauth:register-client -- <client-name> <redirect-uri> [...]");
}
for (const redirectUri of redirectUris) new URL(redirectUri);

try {
  const client = await auth.api.adminCreateOAuthClient({
    body: {
      application_type: "native",
      client_name: clientName,
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: redirectUris,
      require_pkce: true,
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
  });
  process.stdout.write(`${client.client_id}\n`);
} finally {
  await database.close();
}
