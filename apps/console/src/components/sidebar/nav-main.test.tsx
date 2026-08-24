import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { SidebarProvider } from "@taskome/ui/components/sidebar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { NavMain } from "./nav-main";

afterEach(() => vi.unstubAllGlobals());

test("shows named Utility links when Utilities is expanded", async () => {
  vi.stubGlobal("matchMedia", () => ({
    addEventListener() {},
    addListener() {},
    dispatchEvent: () => false,
    matches: false,
    media: "(max-width: 767px)",
    onchange: null,
    removeEventListener() {},
    removeListener() {},
  }));

  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider>
        <NavMain
          overview={{ icon: <span />, title: "Overview", url: "/" }}
          sections={[
            {
              label: "Workspace",
              items: [
                {
                  children: [
                    { title: "Structure Viewer", url: "/utilities/structure-viewer" },
                    { title: "MSA Viewer", url: "#" },
                    { title: "Molecule Drawer", url: "#" },
                  ],
                  icon: <span />,
                  title: "Utilities",
                },
              ],
            },
          ]}
        />
      </SidebarProvider>
    ),
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute,
  });
  const user = userEvent.setup();

  render(<RouterProvider router={router} />);
  await user.click(await screen.findByRole("button", { name: "Utilities" }));

  expect(screen.getByRole("link", { name: "Structure Viewer" })).toBeDefined();
  expect(screen.getByRole("link", { name: "MSA Viewer" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Molecule Drawer" })).toBeDefined();
});
