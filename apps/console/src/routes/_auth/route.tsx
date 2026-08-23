import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@taskome/ui/components/sidebar";
import type { CSSProperties } from "react";

import { RouteErrorState, RoutePendingState } from "@/components/common/route-state";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { getCurrentSession } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
    return { session };
  },
  pendingComponent: RoutePendingState,
  errorComponent: RouteErrorState,
  component: AuthLayout,
});

function AuthLayout() {
  const { session } = Route.useRouteContext();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
        } as CSSProperties
      }
    >
      <AppSidebar user={session.user} variant="inset" />
      <SidebarInset>
        <div className="flex h-12 shrink-0 items-center px-2 md:hidden">
          <SidebarTrigger />
        </div>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
