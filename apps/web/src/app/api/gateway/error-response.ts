import { GatewayAuthenticationError, GatewayHttpError } from "@taskome/api-client";

export function gatewayErrorResponse(error: unknown): Response {
  if (error instanceof GatewayAuthenticationError) {
    return Response.json(
      { error: "authentication_required" },
      { headers: { "WWW-Authenticate": "Bearer" }, status: 401 },
    );
  }
  if (error instanceof GatewayHttpError) {
    return Response.json(error.problem, { status: error.status });
  }
  return Response.json({ error: "gateway_unavailable" }, { status: 502 });
}
