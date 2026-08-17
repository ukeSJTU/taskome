import { auth } from "@taskome/auth";
import { headers } from "next/headers";

import { ApiKeysTable } from "./api-keys-table";

export async function ApiKeysList() {
  const result = await auth.api.listApiKeys({
    headers: await headers(),
    query: { sortBy: "createdAt", sortDirection: "desc" },
  });

  return <ApiKeysTable initialKeys={result.apiKeys.filter((key) => key.enabled)} />;
}
