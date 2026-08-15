"use client";

import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { LanguageSwitcher } from "@/app/(localized)/[locale]/_components/language-switcher";
import { authClient } from "@/lib/auth-client";
import { Button } from "@taskome/ui/components/button";
import { Input } from "@taskome/ui/components/input";

export default function TwoFactorSettingsPage() {
  const t = useTranslations("TwoFactorSettings");
  const locale = useLocale();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ backupCodes: string[]; totpURI: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function enable() {
    const { data, error } = await authClient.twoFactor.enable(
      { password },
      { headers: { "x-taskome-locale": locale } },
    );
    if (error) {
      setMessage(error.message ?? error.statusText);
      return;
    }
    setSetup(data);
  }

  async function confirm() {
    const { error } = await authClient.twoFactor.verifyTotp(
      { code },
      { headers: { "x-taskome-locale": locale } },
    );
    setMessage(error ? (error.message ?? error.statusText) : t("enabled"));
  }

  async function disable() {
    const { error } = await authClient.twoFactor.disable(
      { password },
      { headers: { "x-taskome-locale": locale } },
    );
    setMessage(error ? (error.message ?? error.statusText) : t("disabled"));
  }

  if (setup) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-5 p-6">
        <LanguageSwitcher className="self-end text-sm font-medium underline underline-offset-4" />
        <h1 className="text-2xl font-bold">{t("setupTitle")}</h1>
        <QRCodeSVG className="self-center" value={setup.totpURI} />
        <p>{t("scanInstructions")}</p>
        <Input inputMode="numeric" onChange={(event) => setCode(event.target.value)} value={code} />
        <Button onClick={confirm}>{t("confirmSetup")}</Button>
        <section>
          <h2 className="font-semibold">{t("backupCodes")}</h2>
          <p className="text-sm text-muted-foreground">{t("backupInstructions")}</p>
          <ul className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm">
            {setup.backupCodes.map((backupCode) => (
              <li key={backupCode}>{backupCode}</li>
            ))}
          </ul>
        </section>
        {message ? <p className="text-sm">{message}</p> : null}
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <LanguageSwitcher className="self-end text-sm font-medium underline underline-offset-4" />
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Input
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        value={password}
      />
      <div className="flex gap-3">
        <Button onClick={enable}>{t("enable")}</Button>
        <Button onClick={disable} variant="outline">
          {t("disable")}
        </Button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </main>
  );
}
