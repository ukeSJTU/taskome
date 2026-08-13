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

export const preventPersonalApiKeyReactivation = createAuthMiddleware(async (context) => {
  if (context.path !== "/api-key/update") return;
  if (context.body && "enabled" in context.body && context.body.enabled === true) {
    throw new APIError("BAD_REQUEST", {
      message: "Revoked Personal API Keys cannot be reactivated.",
    });
  }
});
