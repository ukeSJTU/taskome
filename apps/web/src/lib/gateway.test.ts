// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const getToken = vi.fn();
const requestHeaders = new Headers({ cookie: "better-auth.session_token=session" });
const nextHeaders = vi.fn(async () => requestHeaders);

vi.mock("server-only", () => ({}));
vi.mock("@taskome/auth", () => ({ auth: { api: { getToken } } }));
vi.mock("@taskome/env/server", () => ({ env: { GATEWAY_URL: "http://gateway.test" } }));
vi.mock("next/headers", () => ({ headers: nextHeaders }));

const { GatewayAuthenticationError, gatewayFetch } = await import("./gateway");

describe("gatewayFetch", () => {
  it("attaches a short-lived Better Auth JWT to server-side gateway calls", async () => {
    getToken.mockResolvedValueOnce({ token: "session-jwt" });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await gatewayFetch("/api/v1/auth/me");

    expect(getToken).toHaveBeenCalledWith({ headers: requestHeaders });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toBe("http://gateway.test/api/v1/auth/me");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.cache).toBe("no-store");
    expect((options.headers as Headers).get("authorization")).toBe("Bearer session-jwt");
  });

  it("rejects gateway calls without a current session token", async () => {
    getToken.mockResolvedValueOnce(null);

    await expect(gatewayFetch("/api/v1/auth/me")).rejects.toBeInstanceOf(
      GatewayAuthenticationError,
    );
  });
});
