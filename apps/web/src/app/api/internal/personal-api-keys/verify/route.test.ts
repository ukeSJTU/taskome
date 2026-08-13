import { createTestAuth } from "@taskome/auth/test";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

type TestAuth = ReturnType<typeof createTestAuth>;

const authState = vi.hoisted(() => ({ auth: null as TestAuth | null }));
const sharedSecret = "web-gateway-test-secret-at-least-32-characters";

vi.mock("server-only", () => ({}));
vi.mock("@taskome/env/server", () => ({
  env: { WEB_GATEWAY_HMAC_SECRET: sharedSecret },
}));
vi.mock("@taskome/auth", async () => {
  const { createTestAuth: createMockAuth } = await import("@taskome/auth/test");
  const auth = createMockAuth();
  authState.auth = auth;
  return { auth };
});

const { POST } = await import("./route");

function signedRequest(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", sharedSecret)
    .update(`${timestamp}.`)
    .update(body)
    .digest("hex");
  return new Request("http://localhost:3000/api/internal/personal-api-keys/verify", {
    body,
    headers: {
      "content-type": "application/json",
      "x-taskome-signature": signature,
      "x-taskome-timestamp": String(timestamp),
    },
    method: "POST",
  });
}

async function createKey() {
  const auth = authState.auth;
  if (!auth) throw new Error("test auth was not initialized");
  const context = await auth.$context;
  const user = await context.test.saveUser(
    context.test.createUser({ email: "direct-client@example.com", name: "Direct Client" }),
  );
  const key = await auth.api.createApiKey({
    body: { name: "Gateway verifier", userId: user.id },
  });
  return { auth, context, key, user };
}

describe("POST /api/internal/personal-api-keys/verify", () => {
  it("returns only the active User and key identity for a valid signed request", async () => {
    const { key, user } = await createKey();
    const response = await POST(signedRequest(JSON.stringify({ key: key.key })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      active: true,
      key_id: key.id,
      user_id: user.id,
    });
  });

  it("returns an inactive result for invalid, revoked, or orphaned keys", async () => {
    const { auth, context, key, user } = await createKey();
    const invalid = await POST(signedRequest(JSON.stringify({ key: "taskome_invalid" })));
    await context.adapter.update({
      model: "apikey",
      update: { enabled: false },
      where: [{ field: "id", value: key.id }],
    });
    const revoked = await POST(signedRequest(JSON.stringify({ key: key.key })));
    const replacement = await auth.api.createApiKey({
      body: { name: "Orphaned", userId: user.id },
    });
    await context.adapter.delete({
      model: "user",
      where: [{ field: "id", value: user.id }],
    });
    const orphaned = await POST(signedRequest(JSON.stringify({ key: replacement.key })));

    for (const response of [invalid, revoked, orphaned]) {
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ active: false, key_id: null, user_id: null });
    }
  });

  it("rejects invalid or stale HMAC signatures", async () => {
    const body = JSON.stringify({ key: "taskome_secret" });
    const invalid = signedRequest(body);
    invalid.headers.set("x-taskome-signature", "0".repeat(64));
    const stale = signedRequest(body, Math.floor(Date.now() / 1000) - 301);

    expect((await POST(invalid)).status).toBe(401);
    expect((await POST(stale)).status).toBe(401);
  });
});
