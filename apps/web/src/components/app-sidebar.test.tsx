import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarProvider } from "@taskome/ui/components/sidebar";

import { AppSidebar } from "./app-sidebar";

describe("AppSidebar", () => {
  it("renders the signed-in user's name", () => {
    render(
      <SidebarProvider>
        <AppSidebar user={{ name: "Ada Lovelace", email: "ada@example.com", avatar: "" }} />
      </SidebarProvider>,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });
});
