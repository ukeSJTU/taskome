import { auth } from "@taskome/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ApiKeysList } from "./_components/api-keys-list";
import { ApiKeysManager } from "./_components/api-keys-manager";
import { ApiKeysTableSkeleton } from "./_components/api-keys-table";

export default async function ApiKeysSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <section className="max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a separate key for every local script or machine. Keys carry your current access
          and cannot be restored after you revoke them.
        </p>
      </div>
      <ApiKeysManager>
        <Suspense fallback={<ApiKeysTableSkeleton />}>
          <ApiKeysList />
        </Suspense>
      </ApiKeysManager>
    </section>
  );
}
