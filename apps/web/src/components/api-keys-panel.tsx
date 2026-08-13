"use client";

import type { ApiKey } from "@better-auth/api-key/client";
import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon, PlusIcon, ShieldOffIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Badge } from "@taskome/ui/components/badge";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@taskome/ui/components/alert-dialog";
import { Button } from "@taskome/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@taskome/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@taskome/ui/components/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@taskome/ui/components/field";
import { Input } from "@taskome/ui/components/input";
import { Skeleton } from "@taskome/ui/components/skeleton";

type ManagedApiKey = Omit<ApiKey, "key">;

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: Date | string) {
  return dateFormatter.format(new Date(value));
}

function KeyList({
  keys,
  kind,
  pendingKeyId,
  onRevoke,
}: {
  keys: ManagedApiKey[];
  kind: "active" | "revoked";
  pendingKeyId: string | null;
  onRevoke: (key: ManagedApiKey) => Promise<unknown>;
}) {
  if (keys.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {kind === "active" ? <KeyRoundIcon /> : <ShieldOffIcon />}
          </EmptyMedia>
          <EmptyTitle>{kind === "active" ? "No active keys" : "No revoked keys"}</EmptyTitle>
          <EmptyDescription>
            {kind === "active"
              ? "Create a key for each script or machine that needs API access."
              : "Keys you revoke will remain here as an immutable history."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {keys.map((key) => (
        <li
          className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
          key={key.id}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{key.name}</span>
              <Badge variant={kind === "active" ? "secondary" : "outline"}>
                {kind === "active" ? "Active" : "Revoked"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <code>{key.start ? `${key.start}…` : `${key.prefix ?? "taskome_"}…`}</code>
              <span aria-hidden="true"> · </span>
              {kind === "active" ? "Created" : "Revoked"} {formatDate(key.updatedAt)}
            </p>
          </div>
          {kind === "active" ? (
            <Button
              aria-label={`Revoke ${key.name}`}
              disabled={pendingKeyId === key.id}
              onClick={() => void onRevoke(key)}
              size="sm"
              type="button"
              variant="destructive"
            >
              <ShieldOffIcon data-icon="inline-start" />
              {pendingKeyId === key.id ? "Revoking…" : "Revoke"}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ManagedApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingKeyId, setPendingKeyId] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ManagedApiKey | null>(null);
  const [name, setName] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadKeys() {
    const result = await authClient.apiKey.list({
      query: { sortBy: "createdAt", sortDirection: "desc" },
    });
    if (result.error) {
      setError("We couldn't load your API keys. Try again.");
      return false;
    }
    setKeys(result.data.apiKeys);
    setError(null);
    return true;
  }

  useEffect(() => {
    let active = true;
    void loadKeys().finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a name that identifies the script or machine using this key.");
      return;
    }

    setIsCreating(true);
    setError(null);
    const result = await authClient.apiKey.create({ name: trimmedName });
    if (result.error) {
      setError(result.error.message || "We couldn't create the API key. Try again.");
      setIsCreating(false);
      return;
    }

    setRevealedSecret(result.data.key);
    setCopied(false);
    setName("");
    await loadKeys();
    setIsCreating(false);
  }

  async function revokeKey(key: ManagedApiKey) {
    setPendingKeyId(key.id);
    setError(null);
    const result = await authClient.apiKey.update({ enabled: false, keyId: key.id });
    if (result.error) {
      setError(result.error.message || `We couldn't revoke ${key.name}. Try again.`);
      setPendingKeyId(null);
      return false;
    }
    await loadKeys();
    setPendingKeyId(null);
    return true;
  }

  async function copySecret() {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret);
      setCopied(true);
      setError(null);
    } catch {
      setError(
        "Copy failed. Select the visible key and copy it manually before leaving this page.",
      );
    }
  }

  const activeKeys = keys.filter((key) => key.enabled);
  const revokedKeys = keys.filter((key) => !key.enabled);
  const nameError = error?.startsWith("Enter a name") ? error : null;

  return (
    <div className="mx-auto flex min-w-0 w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Personal API keys</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a separate key for every local script or machine. Keys carry your current access
          and cannot be restored after you revoke them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Create an API key</h2>
          </CardTitle>
          <CardDescription>
            Give the key a recognizable name. The secret is shown only once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={createKey}>
            <FieldGroup>
              <Field data-invalid={nameError ? true : undefined}>
                <FieldLabel htmlFor="api-key-name">Key name</FieldLabel>
                <Input
                  aria-invalid={nameError ? true : undefined}
                  autoComplete="off"
                  disabled={isCreating}
                  id="api-key-name"
                  maxLength={32}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (nameError) setError(null);
                  }}
                  placeholder="Workstation or cluster submitter"
                  value={name}
                />
                <FieldDescription>
                  Use a name that identifies where this key is stored.
                </FieldDescription>
                <FieldError errors={nameError ? [{ message: nameError }] : []} />
              </Field>
            </FieldGroup>
            <div>
              <Button disabled={isCreating} type="submit">
                <PlusIcon data-icon="inline-start" />
                {isCreating ? "Creating…" : "Create API key"}
              </Button>
            </div>
          </form>

          {revealedSecret ? (
            <section aria-live="polite" className="mt-5 flex flex-col gap-3 border bg-muted/40 p-4">
              <div>
                <h2 className="font-medium">Copy this key now</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Taskome stores only a hash. You won't be able to reveal this secret again.
                </p>
              </div>
              <code
                aria-label="New Personal API Key"
                className="overflow-x-auto border bg-background p-3 text-xs"
              >
                {revealedSecret}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void copySecret()} type="button" variant="outline">
                  {copied ? (
                    <CheckIcon data-icon="inline-start" />
                  ) : (
                    <CopyIcon data-icon="inline-start" />
                  )}
                  {copied ? "Copied" : "Copy key"}
                </Button>
                <Button onClick={() => setRevealedSecret(null)} type="button" variant="secondary">
                  I've saved it
                </Button>
              </div>
            </section>
          ) : null}

          <FieldError className="mt-4" errors={error && !nameError ? [{ message: error }] : []} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Active keys</h2>
            </CardTitle>
            <CardDescription>Keys currently accepted for Direct API requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-3" aria-label="Loading active keys">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <KeyList
                keys={activeKeys}
                kind="active"
                onRevoke={(key) => {
                  setKeyToRevoke(key);
                  return Promise.resolve();
                }}
                pendingKeyId={pendingKeyId}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Revoked history</h2>
            </CardTitle>
            <CardDescription>
              Retained metadata for keys that can never be used again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-3" aria-label="Loading revoked keys">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <KeyList
                keys={revokedKeys}
                kind="revoked"
                onRevoke={revokeKey}
                pendingKeyId={pendingKeyId}
              />
            )}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Rotate a key by creating its replacement before revoking the old one.
          </CardFooter>
        </Card>
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !pendingKeyId) setKeyToRevoke(null);
        }}
        open={keyToRevoke !== null}
      >
        <AlertDialogPortal>
          <AlertDialogOverlay />
          <AlertDialogContent>
            <div className="grid gap-1.5">
              <AlertDialogTitle>Revoke {keyToRevoke?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This key will stop working immediately and cannot be restored. Its metadata will
                remain in revoked history.
              </AlertDialogDescription>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
              <Button
                disabled={pendingKeyId !== null}
                onClick={() => {
                  if (!keyToRevoke) return;
                  void revokeKey(keyToRevoke).then((revoked) => {
                    if (revoked) setKeyToRevoke(null);
                  });
                }}
                type="button"
                variant="destructive"
              >
                {pendingKeyId ? "Revoking…" : "Revoke permanently"}
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialogPortal>
      </AlertDialog>
    </div>
  );
}
