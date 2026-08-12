import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ logger }, { getRequestId }] = await Promise.all([
    import("./lib/logger"),
    import("./lib/request-context"),
  ]);
  logger.error(
    {
      err: error,
      method: request.method,
      request_id: getRequestId(),
      route: context.routePath,
      route_type: context.routeType,
    },
    "server request failed",
  );
};
