import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";
import { SidebarProvider } from "@taskome/ui/components/sidebar";

const usePathname = vi.fn(() => "/api-docs");

vi.mock("next/navigation", () => ({ usePathname }));

const { SiteHeader } = await import("./site-header");

describe("SiteHeader", () => {
  it("shows API Docs on the API Docs route", () => {
    render(
      <SidebarProvider>
        <SiteHeader />
      </SidebarProvider>,
    );

    expect(screen.getByRole("heading", { name: "API Docs" })).toBeInTheDocument();
  });
});
