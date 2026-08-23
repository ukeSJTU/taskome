import type { EvlogVariables } from "evlog/hono";

import type { SessionIdentity } from "@/auth/session";

export interface AppEnv {
  Variables: EvlogVariables["Variables"] & {
    requestId: string;
    session: SessionIdentity;
  };
}
