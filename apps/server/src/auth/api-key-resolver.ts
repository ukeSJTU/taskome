import type { Auth } from "@/auth";
import type { Database } from "@/db/database";
import { securityEvent } from "@/db/schema";
import type { VerifyApiKey } from "./security-context";

export function createApiKeyResolver(auth: Auth, db: Database): VerifyApiKey {
  return async (secret, correlation) => {
    const result = await auth.api.verifyApiKey({ body: { key: secret } });
    if (!result.valid || !result.key) return null;
    await db.insert(securityEvent).values({
      actorUserId: result.key.referenceId,
      credentialId: result.key.id,
      id: crypto.randomUUID(),
      operation: "api_key.used",
      requestId: correlation.requestId,
      result: "succeeded",
      targetId: result.key.id,
      targetType: "api_key",
    });
    return {
      id: result.key.id,
      ownerUserId: result.key.referenceId,
      permissions: result.key.permissions,
    };
  };
}
