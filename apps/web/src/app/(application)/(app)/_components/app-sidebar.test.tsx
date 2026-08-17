import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@taskome/ui/components/sidebar";

import { render, screen, waitFor, within } from "@/test/render";

import { AppSidebar } from "./app-sidebar";

const pathname = vi.hoisted(() => ({ value: "/dashboard" }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
  useRouter: () => router,
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
  it("opens the route search with its header button or keyboard shortcut", async () => {
    pathname.value = "/dashboard";
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "Search pages" }));
    expect(screen.getByRole("dialog", { name: "Search pages" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog", { name: "Search pages" })).toBeInTheDocument();
  });

  it("groups the complete route surface and keeps planned destinations inert", async () => {
    pathname.value = "/dashboard";
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "Search pages" }));
    const palette = screen.getByRole("dialog", { name: "Search pages" });

    for (const group of ["App", "Tools", "Viewers", "Settings"]) {
      expect(within(palette).getByText(group)).toBeInTheDocument();
    }
    for (const destination of [
      "Dashboard",
      "All Tools",
      "My Results",
      "Projects",
      "Batch",
      "Pipelines",
      "Files",
      "AI Assistant",
      "PDB Viewer",
      "MSA Viewer",
      "Molecule Drawer",
      "General",
      "Usage",
      "API Keys",
      "Notifications",
      "Security",
    ]) {
      expect(within(palette).getByText(destination)).toBeInTheDocument();
    }
    expect(within(palette).queryByRole("option", { name: "Viewers" })).not.toBeInTheDocument();
    expect(within(palette).queryByRole("option", { name: "Settings" })).not.toBeInTheDocument();

    const projects = within(palette).getByText("Projects").closest("[cmdk-item]");
    expect(projects).toHaveAttribute("aria-disabled", "true");
    expect(within(projects as HTMLElement).getByText("Coming soon")).toBeInTheDocument();
    await user.click(within(palette).getByText("Projects"));
    expect(router.push).not.toHaveBeenCalled();
    expect(palette).toBeInTheDocument();
  });

  it("finds aliases, navigates enabled routes, and closes without re-navigating the current page", async () => {
    pathname.value = "/dashboard";
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "Search pages" }));
    const search = screen.getByRole("combobox", { name: "Search pages" });
    await user.type(search, "alignment");
    expect(screen.getByText("MSA Viewer")).toBeInTheDocument();
    expect(screen.queryByText("PDB Viewer")).not.toBeInTheDocument();

    await user.click(screen.getByText("MSA Viewer"));
    expect(router.push).toHaveBeenCalledWith("/viewers/msa");
    expect(screen.queryByRole("dialog", { name: "Search pages" })).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByLabelText("Current page")).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("dialog", { name: "Search pages" })).getByText("Dashboard"),
    );
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Search pages" })).not.toBeInTheDocument();
  });

  it("shows an empty result message when no page matches", async () => {
    pathname.value = "/dashboard";
    const user = userEvent.setup();
    renderSidebar();

    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(screen.getByRole("combobox", { name: "Search pages" }), "unfindable");

    expect(screen.getByText("No matching pages found.")).toBeInTheDocument();
  });

  it("keeps the route shortcut available when the desktop sidebar is collapsed", async () => {
    pathname.value = "/dashboard";
    const user = userEvent.setup();
    renderSidebar(false);

    await user.keyboard("{Control>}k{/Control}");

    expect(screen.getByRole("dialog", { name: "Search pages" })).toBeInTheDocument();
  });

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

    expect(screen.getByRole("link", { name: "PDB Viewer" })).toHaveAttribute(
      "href",
      "/viewers/pdb",
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

    expect(await screen.findByRole("menuitem", { name: "PDB Viewer" })).toHaveAttribute(
      "href",
      "/viewers/pdb",
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

  it("closes the mobile drawer when navigating from the palette", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    pathname.value = "/dashboard";
    const user = userEvent.setup();

    try {
      renderSidebar();
      await user.keyboard("{Control>}b{/Control}");
      const drawer = await screen.findByRole("dialog", { name: "Sidebar" });
      await user.click(within(drawer).getByRole("button", { name: "Search pages" }));
      await user.click(
        within(screen.getByRole("dialog", { name: "Search pages" })).getByText("Files"),
      );

      expect(router.push).toHaveBeenCalledWith("/files");
      expect(screen.queryByRole("dialog", { name: "Search pages" })).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Sidebar" })).not.toBeInTheDocument(),
      );
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    }
  });
});
