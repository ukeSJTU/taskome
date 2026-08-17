import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTestAuth } from "@/test/auth";
import { render, screen } from "@/test/render";

import { ApiKeysManager } from "./api-keys-manager";
import { ApiKeysTable } from "./api-keys-table";

function ApiKeysPanel() {
  return (
    <ApiKeysManager>
      <ApiKeysTable initialKeys={[]} />
    </ApiKeysManager>
  );
}

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

    expect(screen.getByText("No active keys")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New API key" }));
    await user.click(screen.getByRole("button", { name: "Create API key" }));
    expect(
      screen.getByText("Enter a name that identifies the script or machine using this key."),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Key name"), "Workstation");
    await user.click(screen.getByRole("button", { name: "Create API key" }));

    const revealedSecret = await screen.findByLabelText("New Personal API Key");
    expect(revealedSecret).toHaveTextContent(/^taskome_/);
    expect(screen.getByText(/Copy this key now/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "I've saved it" }));
    expect(screen.queryByLabelText("New Personal API Key")).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Workstation" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Last used" })).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Revoke Workstation" }));
    expect(screen.getByRole("alertdialog", { name: "Revoke Workstation?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("cell", { name: "Workstation" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Revoke Workstation" }));
    await user.click(screen.getByRole("button", { name: "Revoke permanently" }));

    expect(await screen.findByText("No active keys")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Revoked history" })).not.toBeInTheDocument();
    expect(screen.queryByText("Workstation")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "New API key" }));
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
