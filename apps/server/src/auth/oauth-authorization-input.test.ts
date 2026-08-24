import { describe, expect, it } from "vitest";

import { createOAuthAuthorizationInputResolver } from "./oauth-authorization-input";

describe("Better Auth OAuth provider-state contract", () => {
  it("resolves the client, canonical resource, and product scope", async () => {
    const resolve = createOAuthAuthorizationInputResolver(() =>
      Promise.resolve({
        query:
          "client_id=https%3A%2F%2Fclient.example%2Fmetadata.json&resource=https%3A%2F%2Fapi.example%2Fmcp",
      }),
    );

    await expect(
      resolve("https://api.example/mcp", ["openid", "offline_access", "taskome:access"]),
    ).resolves.toEqual({
      clientId: "https://client.example/metadata.json",
      resource: "https://api.example/mcp",
      scopes: ["taskome:access"],
    });
  });

  it("fails closed when provider state is absent", async () => {
    const resolve = createOAuthAuthorizationInputResolver(() => Promise.resolve(null));

    await expect(resolve("https://api.example/mcp", ["taskome:access"])).rejects.toThrow(
      "OAuth provider state is unavailable",
    );
  });

  it("fails closed when the resource does not match", async () => {
    const resolve = createOAuthAuthorizationInputResolver(() =>
      Promise.resolve({ query: "client_id=client&resource=https%3A%2F%2Fapi.example%2Fapi%2Fv1" }),
    );

    await expect(resolve("https://api.example/mcp", ["taskome:access"])).rejects.toThrow(
      "does not match",
    );
  });
});
