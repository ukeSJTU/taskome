import {
  GatewayAuthenticationError,
  GatewayHttpError,
  getCurrentIdentity,
} from "@taskome/api-client";

export async function GET() {
  try {
    const identity = await getCurrentIdentity();
    return Response.json({ authenticated: true, identity });
  } catch (error) {
    if (error instanceof GatewayAuthenticationError) {
      return Response.json(
        { authenticated: false, error: "authentication_required", identity: null },
        { headers: { "WWW-Authenticate": "Bearer" }, status: 401 },
      );
    }
    if (error instanceof GatewayHttpError && error.status === 401) {
      return Response.json(
        { authenticated: false, error: "gateway_authentication_required", identity: null },
        { headers: { "WWW-Authenticate": "Bearer" }, status: 401 },
      );
    }
    return Response.json({ error: "gateway_unavailable" }, { status: 502 });
  }
}
