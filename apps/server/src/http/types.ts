import type { EvlogVariables } from "evlog/hono";

import type { SessionIdentity } from "@/auth/session";
import type { SecurityContext } from "@/auth/security-context";

export interface AppEnv {
  Variables: EvlogVariables["Variables"] & {
    requestId: string;
    securityContext: SecurityContext;
    session: SessionIdentity;
  };
}
