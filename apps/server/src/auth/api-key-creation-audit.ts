import { AsyncLocalStorage } from "node:async_hooks";

interface ApiKeyCreationAudit {
  ownerUserId: string;
  requestId: string;
}

const apiKeyCreationAudit = new AsyncLocalStorage<ApiKeyCreationAudit>();

export function withApiKeyCreationAudit<T>(audit: ApiKeyCreationAudit, operation: () => T): T {
  return apiKeyCreationAudit.run(audit, operation);
}

export function getApiKeyCreationAudit() {
  return apiKeyCreationAudit.getStore();
}
