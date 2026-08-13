"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@taskome/ui/components/button";
import { Input } from "@taskome/ui/components/input";

export default function TwoFactorSettingsPage() {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ backupCodes: string[]; totpURI: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function enable() {
    const { data, error } = await authClient.twoFactor.enable({ password });
    if (error) {
      setMessage(error.message ?? error.statusText);
      return;
    }
    setSetup(data);
  }

  async function confirm() {
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setMessage(
      error ? (error.message ?? error.statusText) : "Two-factor authentication is enabled.",
    );
  }

  async function disable() {
    const { error } = await authClient.twoFactor.disable({ password });
    setMessage(
      error ? (error.message ?? error.statusText) : "Two-factor authentication is disabled.",
    );
  }

  if (setup) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-5 p-6">
        <h1 className="text-2xl font-bold">Set up two-factor authentication</h1>
        <QRCodeSVG className="self-center" value={setup.totpURI} />
        <p>Scan this QR code, then enter the current code from your authenticator app.</p>
        <Input inputMode="numeric" onChange={(event) => setCode(event.target.value)} value={code} />
        <Button onClick={confirm}>Confirm setup</Button>
        <section>
          <h2 className="font-semibold">Backup codes</h2>
          <p className="text-sm text-muted-foreground">
            Save these one-time codes somewhere secure.
          </p>
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
      <h1 className="text-2xl font-bold">Two-factor authentication</h1>
      <p className="text-muted-foreground">
        Confirm your password to enable or disable two-factor authentication.
      </p>
      <Input
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        value={password}
      />
      <div className="flex gap-3">
        <Button onClick={enable}>Enable</Button>
        <Button onClick={disable} variant="outline">
          Disable
        </Button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </main>
  );
}
