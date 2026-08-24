import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { ApiKeysSettingsPage } from "./api-keys-settings-page";

test("shows the user's API key inventory without exposing secrets", () => {
  render(<ApiKeysSettingsPage />);

  expect(screen.getByRole("heading", { name: "API Keys" })).toBeDefined();
  expect(screen.getByText("Research workstation")).toBeDefined();
  expect(screen.getByText("tsk_••••••••7A3F")).toBeDefined();
  expect(screen.getByText("Demo data")).toBeDefined();
  expect(screen.queryByText(/tsk_demo_/)).toBeNull();
});

test("creates a key and reveals its secret once", async () => {
  const user = userEvent.setup();
  render(<ApiKeysSettingsPage />);

  await user.click(screen.getByRole("button", { name: "Create API key" }));
  const createDialog = screen.getByRole("dialog", { name: "Create API key" });
  await user.type(within(createDialog).getByLabelText("Name"), "Notebook automation");
  await user.click(within(createDialog).getByRole("button", { name: "Create API key" }));

  const secretDialog = screen.getByRole("dialog", { name: "Save your API key" });
  expect(within(secretDialog).getByText(/tsk_demo_/)).toBeDefined();
  await user.click(within(secretDialog).getByRole("button", { name: "Copy API key" }));
  expect(within(secretDialog).getByRole("button", { name: "Copied" })).toBeDefined();
  await user.click(within(secretDialog).getByRole("button", { name: "Done" }));

  expect(screen.getByText("Notebook automation")).toBeDefined();
  expect(screen.getByRole("row", { name: /Notebook automation/ }).textContent).toContain(
    "Nov 22, 2026",
  );
  expect(screen.queryByText(/tsk_demo_/)).toBeNull();
});

test("explains how to recover when copying the one-time secret fails", async () => {
  const user = userEvent.setup();
  const writeText = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockRejectedValueOnce(new Error("Clipboard denied"));
  render(<ApiKeysSettingsPage />);

  await user.click(screen.getByRole("button", { name: "Create API key" }));
  const createDialog = screen.getByRole("dialog", { name: "Create API key" });
  await user.type(within(createDialog).getByLabelText("Name"), "CLI prototype");
  await user.click(within(createDialog).getByRole("button", { name: "Create API key" }));

  const secretDialog = screen.getByRole("dialog", { name: "Save your API key" });
  await user.click(within(secretDialog).getByRole("button", { name: "Copy API key" }));

  expect(within(secretDialog).getByRole("alert").textContent).toContain(
    "Copy failed. Select the key and copy it manually.",
  );
  writeText.mockRestore();
});

test("shows a useful zero-key state", () => {
  render(<ApiKeysSettingsPage initialKeys={[]} />);

  expect(screen.getByText("No API keys yet")).toBeDefined();
  expect(screen.getByRole("button", { name: "Create your first API key" })).toBeDefined();
  expect(screen.queryByRole("table")).toBeNull();
});

test("requires confirmation before revoking an active key", async () => {
  const user = userEvent.setup();
  render(<ApiKeysSettingsPage />);

  await user.click(screen.getByRole("button", { name: "Revoke Research workstation" }));
  const revokeDialog = screen.getByRole("alertdialog", {
    name: "Revoke “Research workstation”?",
  });
  await user.click(within(revokeDialog).getByRole("button", { name: "Revoke key" }));

  const row = screen.getByRole("row", { name: /Research workstation/ });
  expect(within(row).getByText("Revoked")).toBeDefined();
  expect(within(row).queryByRole("button", { name: "Revoke Research workstation" })).toBeNull();
});
