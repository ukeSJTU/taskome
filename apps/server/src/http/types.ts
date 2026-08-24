import type { EvlogVariables } from "evlog/hono";

import type { SessionIdentity } from "@/auth/session";
import type { RestSecurityContext } from "@/auth/security-context";

export interface AppEnv {
  Variables: EvlogVariables["Variables"] & {
    requestId: string;
    securityContext: RestSecurityContext;
    session: SessionIdentity;
  };
}
