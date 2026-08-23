import { createFileRoute, redirect } from "@tanstack/react-router";

import { AuthPage } from "@/components/auth/auth-page";
import { SignupForm } from "@/components/auth/signup-form";
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

function SignupPage() {
  return (
    <AuthPage>
      <SignupForm />
    </AuthPage>
  );
}
