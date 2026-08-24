import type { SessionIdentity } from "@/auth/session";

export function getCurrentUser(user: SessionIdentity["user"]) {
  return {
    email: user.email,
    emailVerified: user.emailVerified,
    id: user.id,
    image: user.image ?? null,
    name: user.name,
  };
}
