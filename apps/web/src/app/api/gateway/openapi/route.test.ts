import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { server } from "@/test/msw/server";

const getSession = vi.fn();

vi.mock("@taskome/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@taskome/env/server", () => ({
  env: { GATEWAY_INTERNAL_URL: "http://gateway.test" },
}));

const { GET } = await import("./route");

const projection = {
  openapi: "3.1.0",
  info: { title: "Taskome Gateway", version: "0.1.0" },
  paths: { "/me": { get: { operationId: "getCurrentIdentity" } } },
  servers: [{ url: "https://api.taskome.test/v1" }],
};

describe("GET /api/gateway/openapi", () => {
  it("returns the running Gateway public projection to an authenticated User", async () => {
    getSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    server.use(
      http.get("http://gateway.test/internal/openapi.json", () => HttpResponse.json(projection)),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(projection);
  });

  it("requires an authenticated same-origin session", async () => {
    getSession.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "authentication_required" });
  });

  it.each([
    ["transport failure", () => HttpResponse.error()],
    ["gateway failure", () => new HttpResponse("private failure", { status: 500 })],
    ["malformed projection", () => HttpResponse.json({ paths: [] })],
  ])("maps %s to the stable unavailable response", async (_label, resolver) => {
    getSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    server.use(http.get("http://gateway.test/internal/openapi.json", resolver));

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "api_reference_unavailable" });
  });
});
