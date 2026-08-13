import { describe, expect, it, vi } from "vitest";

const getCurrentIdentity = vi.fn();

vi.mock("@taskome/api-client", () => ({
  GatewayAuthenticationError: class GatewayAuthenticationError extends Error {},
  GatewayHttpError: class GatewayHttpError extends Error {
    status: number;

    constructor(response: Response, _problem: unknown) {
      super();
      this.status = response.status;
    }
  },
  getCurrentIdentity,
}));

const { GET } = await import("./route");

describe("GET /api/gateway/auth", () => {
  it("shapes the gateway identity for the web BFF", async () => {
    getCurrentIdentity.mockResolvedValueOnce({
      user_id: "user-1",
      credential_kind: "session_jwt",
      credential_id: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      identity: {
        user_id: "user-1",
        credential_kind: "session_jwt",
        credential_id: null,
      },
    });
  });

  it("returns an authentication error without exposing gateway response details", async () => {
    const { GatewayAuthenticationError } = await import("@taskome/api-client");
    getCurrentIdentity.mockRejectedValueOnce(new GatewayAuthenticationError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await response.json()).toEqual({
      authenticated: false,
      error: "authentication_required",
      identity: null,
    });
  });

  it("maps a gateway 401 to the BFF authentication contract", async () => {
    const GatewayHttpError = (await import("@taskome/api-client")).GatewayHttpError;
    getCurrentIdentity.mockRejectedValueOnce(
      new GatewayHttpError(new Response(null, { status: 401 }), {
        detail: "Authentication is required.",
        instance: "/v1/me",
        request_id: "test-request-id",
        status: 401,
        title: "Unauthorized",
        type: "about:blank",
      }),
    );

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await response.json()).toEqual({
      authenticated: false,
      error: "gateway_authentication_required",
      identity: null,
    });
  });
});
