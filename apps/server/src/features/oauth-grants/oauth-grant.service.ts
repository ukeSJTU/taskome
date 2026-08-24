import type { Database } from "@/db/database";
import { createOAuthGrantRepository } from "./oauth-grant.repository";

export function createOAuthGrantManagementService(db: Database) {
  const repository = createOAuthGrantRepository(db);

  return {
    get: repository.get,
    list: repository.list,
    revoke: repository.revoke,
  };
}

export type OAuthGrantManagementService = ReturnType<typeof createOAuthGrantManagementService>;
