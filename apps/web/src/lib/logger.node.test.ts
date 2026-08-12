// @vitest-environment node

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
        password: "secret-password",
        nested: { token: "secret-token" },
      },
      "test event",
    );

    const event = JSON.parse(line);
    expect(event).toMatchObject({
      msg: "test event",
      authorization: "[Redacted]",
      password: "[Redacted]",
      nested: { token: "[Redacted]" },
    });
    expect(line).not.toContain("secret-");
  });
});
