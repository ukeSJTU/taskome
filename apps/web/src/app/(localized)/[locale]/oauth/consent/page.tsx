"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { LanguageSwitcher } from "@/app/(localized)/[locale]/_components/language-switcher";
import { Button } from "@taskome/ui/components/button";

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<main className="min-h-svh" />}>
      <OAuthConsentContent />
    </Suspense>
  );
}

function OAuthConsentContent() {
  const t = useTranslations("OAuthConsent");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const clientId = searchParams.get("client_id") ?? t("fallbackClient");
  const scope = searchParams.get("scope") ?? "";

  async function submit(accept: boolean) {
    setSubmitting(true);
    await authClient.oauth2.consent({ accept, scope }, { headers: { "x-taskome-locale": locale } });
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-6 p-6">
      <LanguageSwitcher className="self-end text-sm font-medium underline underline-offset-4" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t("title", { clientId })}</h1>
        <p className="text-muted-foreground">
          {t("description", { scope: scope || t("accountScope") })}
        </p>
      </div>
      <div className="flex gap-3">
        <Button disabled={submitting} onClick={() => submit(true)}>
          {t("allow")}
        </Button>
        <Button disabled={submitting} variant="outline" onClick={() => submit(false)}>
          {t("deny")}
        </Button>
      </div>
    </main>
  );
}
