import type { Auth } from "@/auth";

export interface SessionIdentity {
  session: {
    id: string;
  };
  user: {
    email: string;
    emailVerified: boolean;
    id: string;
    image: null | string | undefined;
    name: string;
  };
}

export type GetSession = (headers: Headers) => Promise<SessionIdentity | null>;

export function createSessionResolver(auth: Auth): GetSession {
  return async (headers) => {
    const result = await auth.api.getSession({ headers });
    if (!result) return null;

    return {
      session: { id: result.session.id },
      user: {
        email: result.user.email,
        emailVerified: result.user.emailVerified,
        id: result.user.id,
        image: result.user.image,
        name: result.user.name,
      },
    };
  };
}
