import type { SessionIdentity } from "@/auth/session";

export function getCurrentUser(session: SessionIdentity) {
  return {
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    id: session.user.id,
    image: session.user.image ?? null,
    name: session.user.name,
  };
}
