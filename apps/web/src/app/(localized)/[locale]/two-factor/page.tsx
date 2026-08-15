"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { LanguageSwitcher } from "@/app/(localized)/[locale]/_components/language-switcher";
import { Button } from "@taskome/ui/components/button";
import { Input } from "@taskome/ui/components/input";

export default function TwoFactorPage() {
  const t = useTranslations("TwoFactor");
  const locale = useLocale();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<"totp" | "backup">("totp");
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    const { error: verificationError } =
      method === "totp"
        ? await authClient.twoFactor.verifyTotp(
            { code },
            { headers: { "x-taskome-locale": locale } },
          )
        : await authClient.twoFactor.verifyBackupCode(
            { code },
            { headers: { "x-taskome-locale": locale } },
          );
    if (verificationError) {
      setError(verificationError.message ?? verificationError.statusText);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-4 p-6">
      <LanguageSwitcher className="self-end text-sm font-medium underline underline-offset-4" />
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">
        {method === "totp" ? t("totpDescription") : t("backupDescription")}
      </p>
      <Input onChange={(event) => setCode(event.target.value)} value={code} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={verify}>{t("verify")}</Button>
      <Button
        onClick={() => {
          setError(null);
          setCode("");
          setMethod(method === "totp" ? "backup" : "totp");
        }}
        variant="link"
      >
        {method === "totp" ? t("useBackup") : t("useAuthenticator")}
      </Button>
    </main>
  );
}
