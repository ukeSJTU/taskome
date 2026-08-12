"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@taskome/ui/components/button";
import { Input } from "@taskome/ui/components/input";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    const { error: verificationError } = await authClient.twoFactor.verifyTotp({ code });
    if (verificationError) {
      setError(verificationError.message ?? verificationError.statusText);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Verify your identity</h1>
      <p className="text-muted-foreground">Enter the code from your authenticator app.</p>
      <Input inputMode="numeric" onChange={(event) => setCode(event.target.value)} value={code} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={verify}>Verify</Button>
    </main>
  );
}
