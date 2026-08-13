import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
});

vi.mock("server-only", () => ({}));

import { createLogger } from "./logger";

describe("server logger", () => {
  it("emits JSON and redacts sensitive structured fields", () => {
    const output = new PassThrough();
    let line = "";
    output.on("data", (chunk: Buffer) => {
      line += chunk.toString();
    });

    createLogger(output).info(
      {
        authorization: "Bearer secret-authorization",
        api_key: "secret-api-key",
        password: "secret-password",
        nested: { signature: "secret-signature", token: "secret-token" },
      },
      "test event",
    );

    const event = JSON.parse(line);
    expect(event).toMatchObject({
      msg: "test event",
      authorization: "[Redacted]",
      api_key: "[Redacted]",
      password: "[Redacted]",
      nested: { signature: "[Redacted]", token: "[Redacted]" },
    });
    expect(line).not.toContain("secret-");
  });
});
