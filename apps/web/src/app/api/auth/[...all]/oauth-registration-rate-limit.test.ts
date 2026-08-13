import { createTestAuth } from "@taskome/auth/test";
import { describe, expect, it } from "vitest";

const baseURL = "http://localhost:3000";

function registrationRequest(index: number) {
  return new Request(`${baseURL}/api/auth/oauth2/register`, {
    body: JSON.stringify({
      client_name: `MCP Agent ${index}`,
      grant_types: ["authorization_code"],
      redirect_uris: [`http://localhost:${4100 + index}/callback`],
      response_types: ["code"],
      scope: "taskome",
      token_endpoint_auth_method: "none",
      type: "native",
    }),
    headers: new Headers({
      "content-type": "application/json",
      "x-forwarded-for": "192.0.2.10",
    }),
    method: "POST",
  });
}

describe("OAuth client registration rate limit", () => {
  it("keeps the production registration limit of five requests per minute", async () => {
    const auth = createTestAuth();

    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) => auth.handler(registrationRequest(index))),
    );

    expect(responses.slice(0, 5).map((response) => response.status)).toEqual([
      200, 200, 200, 200, 200,
    ]);
    expect(responses[5]?.status).toBe(429);
  });
});
