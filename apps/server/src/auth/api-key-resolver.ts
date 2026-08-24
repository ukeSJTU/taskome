import { eq } from "drizzle-orm";

import type { Auth } from "@/auth";
import type { Database } from "@/db/database";
import { securityEvent, user } from "@/db/schema";
import type { VerifyApiKey } from "./security-context";

export function createApiKeyResolver(auth: Auth, db: Database): VerifyApiKey {
  return async (secret, correlation) => {
    const result = await auth.api.verifyApiKey({ body: { key: secret } });
    if (!result.valid || !result.key) {
      await db.insert(securityEvent).values({
        id: crypto.randomUUID(),
        operation: result.error?.code?.includes("EXPIRED") ? "api_key.expired" : "api_key.denied",
        requestId: correlation.requestId,
        result: "denied",
        targetType: "api_key",
      });
      return null;
    }
    const [owner] = await db
      .select({
        email: user.email,
        emailVerified: user.emailVerified,
        id: user.id,
        image: user.image,
        name: user.name,
      })
      .from(user)
      .where(eq(user.id, result.key.referenceId));
    if (!owner) return null;
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
      user: owner,
    };
  };
}
