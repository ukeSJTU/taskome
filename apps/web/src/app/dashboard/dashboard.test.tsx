// Temporary test written only to verify the Vitest setup works end-to-end.
// Not a real spec for Dashboard — delete once real component tests exist.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { authClient } from "@/lib/auth-client";

import Dashboard from "./dashboard";

const fakeSession: typeof authClient.$Infer.Session = {
  session: {
    id: "session-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "user-1",
    expiresAt: new Date(),
    token: "fake-token",
  },
  user: {
    id: "user-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe("Dashboard", () => {
  it("renders the session user's name", () => {
    render(<Dashboard session={fakeSession} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });
});
