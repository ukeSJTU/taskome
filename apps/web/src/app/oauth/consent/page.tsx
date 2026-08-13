"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@taskome/ui/components/button";

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<main className="min-h-svh" />}>
      <OAuthConsentContent />
    </Suspense>
  );
}

function OAuthConsentContent() {
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const clientId = searchParams.get("client_id") ?? "this application";
  const scope = searchParams.get("scope") ?? "";

  async function submit(accept: boolean) {
    setSubmitting(true);
    await authClient.oauth2.consent({ accept, scope });
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Authorize {clientId}</h1>
        <p className="text-muted-foreground">
          This application requests access to: {scope || "your account"}.
        </p>
      </div>
      <div className="flex gap-3">
        <Button disabled={submitting} onClick={() => submit(true)}>
          Allow
        </Button>
        <Button disabled={submitting} variant="outline" onClick={() => submit(false)}>
          Deny
        </Button>
      </div>
    </main>
  );
}
