import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@taskome/ui/components/sonner";
import { TooltipProvider } from "@taskome/ui/components/tooltip";

import { ThemeProvider } from "@/components/common/theme-provider";
import { RouteErrorState, RouteNotFoundState } from "@/components/common/route-state";

import "../index.css";

export interface RouterAppContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: RouteErrorState,
  notFoundComponent: RouteNotFoundState,
  head: () => ({
    meta: [
      {
        title: "taskome",
      },
      {
        name: "description",
        content: "taskome is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <TooltipProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          storageKey="vite-ui-theme"
        >
          <Outlet />
          <Toaster richColors />
        </ThemeProvider>
      </TooltipProvider>
      <TanStackRouterDevtools position="bottom-left" />
    </>
  );
}
