import { GatewayAuthenticationError, gatewayFetch } from "@/lib/gateway";

export async function GET() {
  try {
    return await gatewayFetch("/api/v1/auth/me");
  } catch (error) {
    if (error instanceof GatewayAuthenticationError) {
      return Response.json(
        { error: "authentication_required" },
        { headers: { "WWW-Authenticate": "Bearer" }, status: 401 },
      );
    }
    throw error;
  }
}
