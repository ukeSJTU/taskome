import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function withRequestId<T>(requestId: string, operation: () => Promise<T>) {
  return requestContext.run({ requestId }, operation);
}

export function getRequestId() {
  return requestContext.getStore()?.requestId;
}
