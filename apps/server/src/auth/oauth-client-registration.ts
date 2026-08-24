import type { Database } from "@/db/database";
import { oauthClient, oauthClientResource } from "@/db/schema";

export async function registerNativeOAuthClient(
  db: Database,
  input: { name: string; redirectUris: string[]; resource: string },
) {
  const now = new Date();
  const clientId = crypto.randomUUID();
  await db.transaction(async (transaction) => {
    await transaction.insert(oauthClient).values({
      applicationType: "native",
      clientId,
      createdAt: now,
      grantTypes: ["authorization_code", "refresh_token"],
      id: crypto.randomUUID(),
      name: input.name,
      redirectUris: input.redirectUris,
      requirePKCE: true,
      responseTypes: ["code"],
      tokenEndpointAuthMethod: "none",
      updatedAt: now,
    });
    await transaction.insert(oauthClientResource).values({
      clientId,
      createdAt: now,
      id: crypto.randomUUID(),
      resourceId: input.resource,
    });
  });
  return clientId;
}
