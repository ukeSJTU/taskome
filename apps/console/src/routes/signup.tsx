import { createFileRoute, redirect } from "@tanstack/react-router";

import { SignupPage } from "@/components/auth/signup-page";
import { RouteErrorState, RoutePendingState } from "@/components/common/route-state";
import { getCurrentSession } from "@/lib/auth-client";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (session) {
      throw redirect({ to: "/" });
    }
  },
  pendingComponent: RoutePendingState,
  errorComponent: RouteErrorState,
  component: SignupPage,
});
