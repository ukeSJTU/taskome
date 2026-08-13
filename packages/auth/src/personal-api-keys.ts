import { apiKey } from "@better-auth/api-key";
import { APIError, createAuthMiddleware } from "better-auth/api";

export function personalApiKeyPlugin() {
  return apiKey({
    defaultPrefix: "taskome_",
    enableSessionForAPIKeys: false,
    keyExpiration: { defaultExpiresIn: null, disableCustomExpiresTime: true },
    rateLimit: { enabled: false },
    requireName: true,
  });
}

export const enforcePersonalApiKeyLifecycle = createAuthMiddleware(async (context) => {
  if (context.path === "/api-key/create") {
    const name = context.body && "name" in context.body ? context.body.name : undefined;
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new APIError("BAD_REQUEST", { message: "Personal API Keys require a name." });
    }

    const prefix = context.body && "prefix" in context.body ? context.body.prefix : undefined;
    if (prefix !== undefined && prefix !== "taskome_") {
      throw new APIError("BAD_REQUEST", {
        message: "Personal API Keys must use the taskome_ prefix.",
      });
    }
    return;
  }

  if (context.path === "/api-key/delete") {
    throw new APIError("BAD_REQUEST", {
      message: "Personal API Key history cannot be deleted.",
    });
  }

  if (context.path !== "/api-key/update") return;
  const body = context.body ?? {};
  const unsupportedFields = Object.keys(body).filter(
    (field) => field !== "keyId" && field !== "enabled",
  );
  if (!("enabled" in body) || body.enabled !== false || unsupportedFields.length > 0) {
    throw new APIError("BAD_REQUEST", {
      message: "Personal API Keys can only be permanently revoked.",
    });
  }
});
