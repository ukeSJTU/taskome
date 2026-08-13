// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@taskome/auth", () => ({ auth: { api: { getToken } } }));
vi.mock("@taskome/env/server", () => ({ env: { GATEWAY_URL: "http://gateway.test" } }));

const {
  GatewayAuthenticationError,
  GatewayHttpError,
  GatewayTransportError,
  deleteInputFile,
  getCurrentIdentity,
  getInputFileDownloadUrl,
} = await import("@taskome/api-client");

describe("gateway API client", () => {
  beforeEach(() => {
    getToken.mockReset();
    vi.unstubAllGlobals();
  });

  it("attaches a short-lived Better Auth JWT to server-side gateway calls", async () => {
    getToken.mockResolvedValueOnce({ token: "session-jwt" });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ aud: "web", iss: "auth", sub: "user" }), {
        headers: { "content-type": "application/json" },
      }),
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

  it("returns the JSON response body directly", async () => {
    getToken.mockResolvedValueOnce({ token: "session-jwt" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ aud: "web", iss: "auth", sub: "user" }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(getCurrentIdentity()).resolves.toEqual({
      aud: "web",
      iss: "auth",
      sub: "user",
    });
  });

  it("returns undefined for a successful response without a body", async () => {
    getToken.mockResolvedValueOnce({ token: "session-jwt" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })));

    await expect(
      deleteInputFile({ inputFileId: "a16e14e7-c0b6-4a34-9e33-0e151e5ac7cd" }),
    ).resolves.toBe(undefined);
  });

  it("raises a parsed Problem Details error for gateway responses", async () => {
    getToken.mockResolvedValueOnce({ token: "session-jwt" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: "urn:taskome:error:input-file-not-found",
            title: "Input File Not Found",
            status: 404,
            detail: "The requested Input File is not available.",
            instance: "/v1/input-files/example/download-url",
            request_id: "request-123",
          }),
          { headers: { "content-type": "application/problem+json" }, status: 404 },
        ),
      ),
    );

    const error = await getInputFileDownloadUrl({
      inputFileId: "a16e14e7-c0b6-4a34-9e33-0e151e5ac7cd",
    }).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(GatewayHttpError);
    expect(error).toMatchObject({
      status: 404,
      problem: {
        request_id: "request-123",
        type: "urn:taskome:error:input-file-not-found",
      },
    });
  });

  it("wraps network failures while preserving their cause", async () => {
    const cause = new TypeError("fetch failed");
    getToken.mockResolvedValueOnce({ token: "session-jwt" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(cause));

    const error = await getCurrentIdentity().catch((error: unknown) => error);

    expect(error).toBeInstanceOf(GatewayTransportError);
    expect(error).toMatchObject({ cause });
  });

  it("rejects gateway calls without a current session token", async () => {
    getToken.mockResolvedValueOnce(null);

    await expect(getCurrentIdentity()).rejects.toBeInstanceOf(GatewayAuthenticationError);
  });
});
