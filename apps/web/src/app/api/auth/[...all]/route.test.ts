// @vitest-environment node

import { createTestAuth } from "@taskome/auth/test";
import { createLocalJWKSet, jwtVerify } from "jose";
import { toNextJsHandler } from "better-auth/next-js";
import { describe, expect, it } from "vitest";

describe("/api/auth", () => {
  it("publishes keys that verify a session JWT", async () => {
    const auth = createTestAuth();
    const handlers = toNextJsHandler(auth);
    const context = await auth.$context;
    const user = await context.test.saveUser(
      context.test.createUser({ email: "agent@example.com", name: "Agent" }),
    );
    const { headers } = await context.test.login({ userId: user.id });

    const jwksResponse = await handlers.GET(new Request("http://localhost:3000/api/auth/jwks"));
    const tokenResponse = await handlers.GET(
      new Request("http://localhost:3000/api/auth/token", { headers }),
    );

    expect(jwksResponse.status).toBe(200);
    const jwks = await jwksResponse.json();
    const { token } = await tokenResponse.json();
    const verified = await jwtVerify(token, createLocalJWKSet(jwks), {
      audience: "http://localhost:3000",
      issuer: "http://localhost:3000",
    });

    expect(verified.payload.sub).toBe(user.id);
  });
});
