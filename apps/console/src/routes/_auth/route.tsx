import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@taskome/ui/components/sidebar";
import type { CSSProperties } from "react";

import { RouteErrorState, RoutePendingState } from "@/components/common/route-state";
import { AppSidebar, SettingsSidebar } from "@/components/sidebar/app-sidebar";
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
  const pathname = useLocation({ select: (location) => location.pathname });
  const isSettingsRoute = pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
        } as CSSProperties
      }
    >
      {isSettingsRoute ? (
        <SettingsSidebar user={session.user} variant="inset" />
      ) : (
        <AppSidebar user={session.user} variant="inset" />
      )}
      <SidebarInset>
        <div className="flex h-12 shrink-0 items-center px-2 md:hidden">
          <SidebarTrigger />
        </div>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
