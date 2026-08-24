import { describe, expect, it } from "vitest";

import { createRestSecurityContextResolver, hasRequiredScope } from "./security-context";

const resource = "https://api.example/api/v1";

describe("REST Security Context", () => {
  it("represents verified API-key facts without guessing an Access Channel", async () => {
    const resolve = createRestSecurityContextResolver({
      getSession: () => Promise.resolve(null),
      resource,
      verifyApiKey: () =>
        Promise.resolve({
          id: "key-1",
          ownerUserId: "user-1",
          permissions: { taskome: ["access"] },
        }),
    });

    const context = await resolve(
      new Request(resource, { headers: { authorization: "Bearer sk-valid" } }),
      { requestId: "request-1" },
    );

    expect(context).toEqual({
      correlation: { requestId: "request-1" },
      credential: { id: "key-1", type: "api_key" },
      resource,
      scopes: ["taskome:access"],
      user: { emailVerified: true, id: "user-1" },
    });
    expect(context).not.toHaveProperty("accessChannel");
    expect(context && hasRequiredScope(context, "taskome:access")).toBe(true);
  });

  it("rejects authority confusion from multiple credential types", async () => {
    const resolve = createRestSecurityContextResolver({
      getSession: () => Promise.resolve(null),
      resource,
      verifyApiKey: () => Promise.resolve(null),
    });
    const request = new Request(resource, {
      headers: {
        authorization: "Bearer sk-valid",
        cookie: "better-auth.session_token=session",
      },
    });

    await expect(resolve(request, { requestId: "request-1" })).rejects.toThrow(
      "multiple_credentials",
    );
  });

  it("uses exact scope membership", () => {
    expect(
      hasRequiredScope(
        {
          correlation: { requestId: "request-1" },
          credential: { id: "key-1", type: "api_key" },
          resource,
          scopes: [],
          user: { emailVerified: true, id: "user-1" },
        },
        "taskome:access",
      ),
    ).toBe(false);
  });
});
