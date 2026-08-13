import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getRequestId, withRequestId } = await import("./request-context");

describe("request context", () => {
  it("has no request id outside of withRequestId", () => {
    expect(getRequestId()).toBeUndefined();
  });

  it("exposes the request id to code running inside the operation", async () => {
    const seen = await withRequestId("request-a", async () => getRequestId());

    expect(seen).toBe("request-a");
  });

  it("returns the operation's result", async () => {
    const result = await withRequestId("request-a", async () => 42);

    expect(result).toBe(42);
  });

  it("does not leak one request's id into a concurrently running request", async () => {
    const barrier = { a: false, b: false };

    const [seenByA, seenByB] = await Promise.all([
      withRequestId("request-a", async () => {
        barrier.a = true;
        while (!barrier.b) await Promise.resolve();
        return getRequestId();
      }),
      withRequestId("request-b", async () => {
        barrier.b = true;
        while (!barrier.a) await Promise.resolve();
        return getRequestId();
      }),
    ]);

    expect(seenByA).toBe("request-a");
    expect(seenByB).toBe("request-b");
  });

  it("clears the request id once the operation completes", async () => {
    await withRequestId("request-a", async () => undefined);

    expect(getRequestId()).toBeUndefined();
  });
});
