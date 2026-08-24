import { AsyncLocalStorage } from "node:async_hooks";

const requestCorrelation = new AsyncLocalStorage<string>();

export function withAuthRequestCorrelation<T>(requestId: string, operation: () => T): T {
  return requestCorrelation.run(requestId, operation);
}

export function getAuthRequestCorrelation() {
  const requestId = requestCorrelation.getStore();
  if (!requestId) throw new Error("Auth request correlation is unavailable");
  return requestId;
}
