import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoginPage } from "@/components/auth/login-page";
import { RouteErrorState, RoutePendingState } from "@/components/common/route-state";
import { getCurrentSession } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (session) {
      throw redirect({ to: "/" });
    }
  },
  pendingComponent: RoutePendingState,
  errorComponent: RouteErrorState,
  component: LoginPage,
});
