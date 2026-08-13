import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTestAuth } from "@/test/auth";
import { render, screen } from "@/test/render";

import { ApiKeysPanel } from "./api-keys-panel";

describe("ApiKeysPanel with the auth backend", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates, reveals once, and permanently revokes a named Personal API Key", async () => {
    const { authenticate, test } = await useTestAuth();
    const owner = await test.saveUser(
      test.createUser({ email: "automation-owner@example.com", name: "Automation Owner" }),
    );
    await authenticate(owner.id);
    const user = userEvent.setup();

    render(<ApiKeysPanel />);

    expect(await screen.findByText("No active keys")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create API key" }));
    expect(
      screen.getByText("Enter a name that identifies the script or machine using this key."),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Key name"), "Workstation");
    await user.click(screen.getByRole("button", { name: "Create API key" }));

    const revealedSecret = await screen.findByLabelText("New Personal API Key");
    expect(revealedSecret).toHaveTextContent(/^taskome_/);
    expect(screen.getByText(/Copy this key now/)).toBeInTheDocument();
    expect(screen.getByText("Workstation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "I've saved it" }));
    expect(screen.queryByLabelText("New Personal API Key")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Revoke Workstation" }));
    expect(screen.getByRole("alertdialog", { name: "Revoke Workstation?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Active")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Revoke Workstation" }));
    await user.click(screen.getByRole("button", { name: "Revoke permanently" }));

    expect(await screen.findByText("No active keys")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revoked history" })).toBeInTheDocument();
    expect(screen.getByText("Workstation")).toBeInTheDocument();
    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Re-enable Workstation" })).not.toBeInTheDocument();
  });

  it("keeps the secret visible and explains manual recovery when copying fails", async () => {
    const { authenticate, test } = await useTestAuth();
    const owner = await test.saveUser(
      test.createUser({ email: "copy-owner@example.com", name: "Copy Owner" }),
    );
    await authenticate(owner.id);
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard unavailable"));
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<ApiKeysPanel />);
    await screen.findByText("No active keys");
    await user.type(screen.getByLabelText("Key name"), "Copy failure");
    await user.click(screen.getByRole("button", { name: "Create API key" }));
    await user.click(await screen.findByRole("button", { name: "Copy key" }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("New Personal API Key")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Copy failed. Select the visible key and copy it manually before leaving this page.",
      ),
    ).toBeInTheDocument();
  });
});
