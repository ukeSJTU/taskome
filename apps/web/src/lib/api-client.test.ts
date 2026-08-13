// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const getToken = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@taskome/auth", () => ({ auth: { api: { getToken } } }));
vi.mock("@taskome/env/server", () => ({ env: { GATEWAY_URL: "http://gateway.test" } }));

const { GatewayAuthenticationError, getCurrentIdentity } = await import("@taskome/api-client");

describe("gateway API client", () => {
  it("attaches a short-lived Better Auth JWT to server-side gateway calls", async () => {
    getToken.mockResolvedValueOnce({ token: "session-jwt" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ aud: "web", iss: "auth", sub: "user" })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await getCurrentIdentity();

    expect(getToken).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toBe("http://gateway.test/api/v1/auth/me");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.cache).toBe("no-store");
    expect((options.headers as Headers).get("authorization")).toBe("Bearer session-jwt");
  });

  it("rejects gateway calls without a current session token", async () => {
    getToken.mockResolvedValueOnce(null);

    await expect(getCurrentIdentity()).rejects.toBeInstanceOf(GatewayAuthenticationError);
  });
});
