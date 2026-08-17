import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@taskome/ui/components/sidebar";

import { render, screen } from "@/test/render";

import { AppSidebar } from "./app-sidebar";

const pathname = vi.hoisted(() => ({ value: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

const user = { name: "Ada Lovelace", email: "ada@example.com", avatar: "" };

function renderSidebar(defaultOpen = true) {
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar user={user} />
    </SidebarProvider>,
  );
}

describe("AppSidebar", () => {
  it("renders Taskome's primary, secondary, and meta navigation", () => {
    pathname.value = "/dashboard";
    renderSidebar();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "All Tools" })).toHaveAttribute("href", "/tools");
    expect(screen.getByRole("link", { name: "My Results" })).toHaveAttribute("href", "/results");
    expect(screen.getByRole("link", { name: "Files" })).toHaveAttribute("href", "/files");
    expect(screen.queryByRole("link", { name: "Docs" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Projects" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("reveals viewer destinations from its expandable navigation entry", async () => {
    pathname.value = "/dashboard";
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "Viewers" }));

    expect(screen.getByRole("link", { name: "Structure Viewer" })).toHaveAttribute(
      "href",
      "/viewers/structure",
    );
    expect(screen.getByRole("link", { name: "MSA Viewer" })).toHaveAttribute(
      "href",
      "/viewers/msa",
    );
    expect(screen.getByRole("link", { name: "Molecule Drawer" })).toHaveAttribute(
      "href",
      "/viewers/molecule-drawer",
    );
  });

  it("reveals viewer destinations on hover while the sidebar is collapsed", async () => {
    pathname.value = "/dashboard";
    const user = userEvent.setup();
    renderSidebar(false);

    await user.hover(screen.getByRole("button", { name: "Viewers" }));

    expect(await screen.findByRole("menuitem", { name: "Structure Viewer" })).toHaveAttribute(
      "href",
      "/viewers/structure",
    );
  });

  it("expands when its collapsed logo is clicked", async () => {
    pathname.value = "/dashboard";
    const user = userEvent.setup();
    renderSidebar(false);

    const sidebar = document.querySelector('[data-slot="sidebar"][data-state]');
    expect(sidebar).toHaveAttribute("data-state", "collapsed");

    await user.click(screen.getByRole("link", { name: "taskome" }));

    expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  it("explains why planned navigation entries are unavailable", async () => {
    pathname.value = "/dashboard";
    const user = userEvent.setup();
    renderSidebar();

    await user.hover(screen.getByRole("button", { name: "Projects" }));

    expect(await screen.findByText("Projects is not available yet.")).toBeInTheDocument();
  });

  it("switches to the Settings navigation for settings URLs", () => {
    pathname.value = "/settings/usage";
    renderSidebar(false);

    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/settings/general",
    );
    expect(screen.getByRole("link", { name: "Usage" })).toHaveAttribute("href", "/settings/usage");
    expect(screen.getByRole("link", { name: "Back to App" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "API Keys" })).toHaveAttribute(
      "href",
      "/settings/api-keys",
    );
    expect(screen.getByText("Back to App")).toHaveClass("sr-only");
    expect(screen.queryByRole("link", { name: "Docs" })).not.toBeInTheDocument();
  });
});
