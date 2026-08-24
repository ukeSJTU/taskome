import { AsyncLocalStorage } from "node:async_hooks";

interface AuthRequestContext {
  clientId: string | null;
  path: string;
  requestId: string;
}

const requestCorrelation = new AsyncLocalStorage<AuthRequestContext>();

export async function withAuthRequestCorrelation<T>(
  request: Request,
  operation: () => T,
): Promise<Awaited<T>> {
  const url = new URL(request.url);
  let clientId = url.searchParams.get("client_id");
  if (!clientId && request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await request.clone().formData();
      const candidate = body.get("client_id");
      if (typeof candidate === "string") clientId = candidate;
    }
  }
  return await requestCorrelation.run(
    {
      clientId,
      path: url.pathname,
      requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
    },
    operation,
  );
}

export function getAuthRequestCorrelation() {
  const context = requestCorrelation.getStore();
  if (!context) throw new Error("Auth request correlation is unavailable");
  return context;
}
