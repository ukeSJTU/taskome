import { permissionsToScopes, type TaskomeScope } from "./scopes";
import type { GetSession, SessionIdentity } from "./session";

export interface RequestCorrelation {
  requestId: string;
}

export type SecurityContext =
  | {
      correlation: RequestCorrelation;
      credential: { id: string; type: "browser_session" };
      resource: string;
      scopes: null;
      user: SessionIdentity["user"];
    }
  | {
      correlation: RequestCorrelation;
      credential: { id: string; type: "api_key" };
      resource: string;
      scopes: TaskomeScope[];
      user: SessionIdentity["user"];
    }
  | {
      correlation: RequestCorrelation;
      credential: { grantId: string; type: "oauth_grant" };
      resource: string;
      scopes: TaskomeScope[];
      user: { emailVerified: boolean; id: string };
    };

export type RestSecurityContext = Extract<SecurityContext, { user: SessionIdentity["user"] }>;

export interface VerifiedApiKey {
  id: string;
  ownerUserId: string;
  permissions: Record<string, string[]> | null | undefined;
  user: SessionIdentity["user"];
}

export type VerifyApiKey = (
  secret: string,
  correlation: RequestCorrelation,
) => Promise<VerifiedApiKey | null>;

const sessionCookie = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/;

export function createRestSecurityContextResolver(options: {
  getSession: GetSession;
  resource: string;
  verifyApiKey: VerifyApiKey;
}) {
  return async (
    request: Request,
    correlation: RequestCorrelation,
  ): Promise<RestSecurityContext | null> => {
    const authorization = request.headers.get("authorization");
    const hasSessionCookie = sessionCookie.test(request.headers.get("cookie") ?? "");
    if (authorization && hasSessionCookie) throw new Error("multiple_credentials");

    if (authorization) {
      const match = /^Bearer (sk-[A-Za-z0-9_-]+)$/.exec(authorization);
      if (!match) return null;
      const key = await options.verifyApiKey(match[1] ?? "", correlation);
      if (!key) return null;
      return {
        correlation,
        credential: { id: key.id, type: "api_key" },
        resource: options.resource,
        scopes: permissionsToScopes(key.permissions),
        user: key.user,
      };
    }

    const session = await options.getSession(request.headers);
    if (!session) return null;
    return {
      correlation,
      credential: { id: session.session.id, type: "browser_session" },
      resource: options.resource,
      scopes: null,
      user: session.user,
    };
  };
}

export function hasRequiredScope(context: SecurityContext, requiredScope: TaskomeScope) {
  return context.scopes === null || context.scopes.includes(requiredScope);
}
