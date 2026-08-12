import { auth } from "@taskome/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { randomUUID } from "node:crypto";

import { logger } from "@/lib/logger";
import { withRequestId } from "@/lib/request-context";

const authHandlers = toNextJsHandler(auth);

async function handleAuthRequest(
  request: Request,
  handler: (request: Request) => Promise<Response>,
) {
  const startedAt = performance.now();
  const requestId = randomUUID();
  const requestLogger = logger.child({ request_id: requestId });

  return withRequestId(requestId, async () => {
    try {
      const response = await handler(request);
      const headers = new Headers(response.headers);
      headers.set("x-request-id", requestId);
      requestLogger.info(
        {
          method: request.method,
          route: "/api/auth/[...all]",
          status_code: response.status,
          duration_ms: Math.round((performance.now() - startedAt) * 100) / 100,
        },
        "authentication request completed",
      );
      return new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
      });
    } catch (error) {
      requestLogger.error(
        {
          err: error,
          method: request.method,
          route: "/api/auth/[...all]",
          status_code: 500,
          duration_ms: Math.round((performance.now() - startedAt) * 100) / 100,
        },
        "authentication request failed",
      );
      return new Response("Internal Server Error", {
        headers: { "x-request-id": requestId },
        status: 500,
      });
    }
  });
}

export const GET = (request: Request) => handleAuthRequest(request, authHandlers.GET);
export const POST = (request: Request) => handleAuthRequest(request, authHandlers.POST);
