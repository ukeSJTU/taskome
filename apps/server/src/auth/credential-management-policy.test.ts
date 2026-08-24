import { describe, expect, it } from "vitest";

import { credentialManagementDenial } from "./credential-management-policy";

describe("credential management policy", () => {
  it("requires a verified email and a session no older than 15 minutes", () => {
    const now = new Date("2026-08-24T12:00:00.000Z").getTime();

    expect(
      credentialManagementDenial({
        emailVerified: false,
        now,
        sessionCreatedAt: new Date(now),
      }),
    ).toBe("email_verification_required");
    expect(
      credentialManagementDenial({
        emailVerified: true,
        now,
        sessionCreatedAt: new Date(now - 16 * 60 * 1000),
      }),
    ).toBe("fresh_session_required");
    expect(
      credentialManagementDenial({
        emailVerified: true,
        now,
        sessionCreatedAt: new Date(now - 14 * 60 * 1000),
      }),
    ).toBeNull();
  });
});
