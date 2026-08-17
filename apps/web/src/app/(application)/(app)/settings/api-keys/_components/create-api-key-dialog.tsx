"use client";

import { CheckIcon, CopyIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@taskome/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@taskome/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@taskome/ui/components/field";
import { Input } from "@taskome/ui/components/input";

export function CreateApiKeyDialog({
  error,
  isCreating,
  onCreate,
}: {
  error: string | null;
  isCreating: boolean;
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  function closeDialog() {
    setOpen(false);
    setName("");
    setNameError(null);
    setRevealedSecret(null);
    setCopied(false);
    setCopyError(null);
  }

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Enter a name that identifies the script or machine using this key.");
      return;
    }

    setNameError(null);
    const secret = await onCreate(trimmedName);
    if (secret) {
      setRevealedSecret(secret);
      setCopied(false);
      setCopyError(null);
    }
  }

  async function copySecret() {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret);
      setCopied(true);
      setCopyError(null);
    } catch {
      setCopyError(
        "Copy failed. Select the visible key and copy it manually before leaving this page.",
      );
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !revealedSecret) closeDialog();
        else setOpen(nextOpen);
      }}
      open={open}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New API key
      </DialogTrigger>
      <DialogContent showCloseButton={!revealedSecret}>
        {revealedSecret ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy this key now</DialogTitle>
              <DialogDescription>
                Taskome stores only a hash. You won't be able to reveal this secret again.
              </DialogDescription>
            </DialogHeader>
            <code
              aria-label="New Personal API Key"
              className="overflow-x-auto border bg-background p-3"
            >
              {revealedSecret}
            </code>
            <FieldError errors={copyError ? [{ message: copyError }] : []} />
            <DialogFooter>
              <Button onClick={() => void copySecret()} type="button" variant="outline">
                {copied ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <CopyIcon data-icon="inline-start" />
                )}
                {copied ? "Copied" : "Copy key"}
              </Button>
              <Button onClick={closeDialog} type="button">
                I've saved it
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create an API key</DialogTitle>
              <DialogDescription>
                Give the key a recognizable name. The secret is shown only once.
              </DialogDescription>
            </DialogHeader>
            <form className="flex flex-col gap-4" onSubmit={(event) => void createKey(event)}>
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
                      if (nameError) setNameError(null);
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
              <FieldError errors={error ? [{ message: error }] : []} />
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button disabled={isCreating} type="submit">
                  {isCreating ? "Creating…" : "Create API key"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
