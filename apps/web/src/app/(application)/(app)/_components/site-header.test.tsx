import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";
import { SidebarProvider } from "@taskome/ui/components/sidebar";

const usePathname = vi.fn(() => "/documents");

vi.mock("next/navigation", () => ({ usePathname }));

const { SiteHeader } = await import("./site-header");

describe("SiteHeader", () => {
  it("does not preserve an API Docs-specific page title", () => {
    render(
      <SidebarProvider>
        <SiteHeader />
      </SidebarProvider>,
    );

    expect(screen.getByRole("heading", { name: "Documents" })).toBeInTheDocument();
  });
});
