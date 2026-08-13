import { describe, expect, it } from "vitest";

import { SidebarProvider } from "@taskome/ui/components/sidebar";

import { render, screen } from "@/test/render";

import { AppSidebar } from "./app-sidebar";

describe("AppSidebar", () => {
  it("renders the signed-in user's name", () => {
    render(
      <SidebarProvider>
        <AppSidebar user={{ name: "Ada Lovelace", email: "ada@example.com", avatar: "" }} />
      </SidebarProvider>,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "API keys" })).toHaveAttribute(
      "href",
      "/account/api-keys",
    );
    expect(screen.getByRole("link", { name: "API reference" })).toHaveAttribute(
      "href",
      "/api-reference",
    );
  });
});
