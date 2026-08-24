import { Alert, AlertDescription, AlertTitle } from "@taskome/ui/components/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@taskome/ui/components/alert-dialog";
import { Badge } from "@taskome/ui/components/badge";
import { Button } from "@taskome/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@taskome/ui/components/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@taskome/ui/components/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@taskome/ui/components/field";
import { Input } from "@taskome/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@taskome/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taskome/ui/components/table";
import {
  CheckIcon,
  ClipboardIcon,
  InfoIcon,
  KeyRoundIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, type FormEvent } from "react";

type ApiKeyRecord = {
  expires: string;
  id: string;
  lastUsed: string;
  name: string;
  prefix: string;
  scope: string;
  state: "active" | "revoked";
};

const initialApiKeys: ApiKeyRecord[] = [
  {
    expires: "Nov 10, 2026",
    id: "research-workstation",
    lastUsed: "2 hours ago",
    name: "Research workstation",
    prefix: "tsk_••••••••7A3F",
    scope: "Full access",
    state: "active",
  },
  {
    expires: "Oct 26, 2026",
    id: "docking-pipeline",
    lastUsed: "3 days ago",
    name: "Docking pipeline",
    prefix: "tsk_••••••••91C2",
    scope: "Full access",
    state: "active",
  },
  {
    expires: "Sep 2, 2026",
    id: "legacy-notebook",
    lastUsed: "Never",
    name: "Legacy notebook",
    prefix: "tsk_••••••••21D0",
    scope: "Full access",
    state: "revoked",
  },
];

const expirationDates: Record<string, string> = {
  "30-days": "Sep 23, 2026",
  "90-days": "Nov 22, 2026",
  "1-year": "Aug 24, 2027",
};

type ApiKeysSettingsPageProps = {
  initialKeys?: ApiKeyRecord[];
};

export function ApiKeysSettingsPage({
  initialKeys: seedKeys = initialApiKeys,
}: ApiKeysSettingsPageProps = {}) {
  const [apiKeys, setApiKeys] = useState(seedKeys);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiration, setExpiration] = useState("90-days");
  const [newSecret, setNewSecret] = useState<string>();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [revokingKey, setRevokingKey] = useState<ApiKeyRecord>();

  const createApiKey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const secret = `tsk_demo_${String(apiKeys.length + 1).padStart(2, "0")}B7Q9`;
    const created: ApiKeyRecord = {
      expires: expirationDates[expiration] ?? "Nov 22, 2026",
      id: `local-${apiKeys.length + 1}`,
      lastUsed: "Never",
      name: trimmedName,
      prefix: "tsk_••••••••B7Q9",
      scope: "Full access",
      state: "active",
    };

    setApiKeys((currentKeys) => [created, ...currentKeys]);
    setCreateOpen(false);
    setName("");
    setExpiration("90-days");
    setCopyStatus("idle");
    setNewSecret(secret);
  };

  const copySecret = async () => {
    if (!newSecret) return;
    try {
      await navigator.clipboard.writeText(newSecret);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const revokeApiKey = () => {
    if (!revokingKey) return;
    setApiKeys((currentKeys) =>
      currentKeys.map((apiKey) =>
        apiKey.id === revokingKey.id ? { ...apiKey, state: "revoked" } : apiKey,
      ),
    );
    setRevokingKey(undefined);
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
            <KeyRoundIcon className="size-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Create and manage credentials for programmatic access.
            </p>
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Create API key
        </Button>
      </header>

      <Alert>
        <InfoIcon />
        <AlertTitle>Store API keys securely</AlertTitle>
        <AlertDescription>
          A new secret is shown only once. You can revoke a key at any time.
        </AlertDescription>
      </Alert>

      <section aria-labelledby="api-key-inventory-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 id="api-key-inventory-title" className="text-base font-medium">
                Your API keys
              </h2>
              <Badge variant="outline">Demo data</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              API key secrets are hidden after creation.
            </p>
          </div>
        </div>

        {apiKeys.length === 0 ? (
          <Empty className="border bg-muted/10 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRoundIcon />
              </EmptyMedia>
              <EmptyTitle>No API keys yet</EmptyTitle>
              <EmptyDescription>
                Create a key when you are ready to connect a script or development tool.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                Create your first API key
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Scope</TableHead>
                  <TableHead className="hidden lg:table-cell">Expires</TableHead>
                  <TableHead className="hidden md:table-cell">Last used</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{apiKey.name}</span>
                        <code className="font-mono text-xs text-muted-foreground">
                          {apiKey.prefix}
                        </code>
                        <span className="flex flex-col text-xs text-muted-foreground md:hidden">
                          <span>
                            {apiKey.scope} · Expires {apiKey.expires}
                          </span>
                          <span>
                            {apiKey.lastUsed === "Never"
                              ? "Never used"
                              : `Last used ${apiKey.lastUsed}`}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{apiKey.scope}</TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground lg:table-cell">
                      {apiKey.expires}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {apiKey.lastUsed}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={apiKey.state === "active" ? "secondary" : "outline"}>
                        {apiKey.state === "active" ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {apiKey.state === "active" ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Revoke ${apiKey.name}`}
                          onClick={() => setRevokingKey(apiKey)}
                        >
                          <Trash2Icon />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give the key a descriptive name so you can recognize where it is used.
            </DialogDescription>
          </DialogHeader>
          <form className="contents" onSubmit={createApiKey}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Research workstation"
                  maxLength={80}
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="api-key-scope">Scope</FieldLabel>
                <Select value="full-access" disabled>
                  <SelectTrigger id="api-key-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="full-access">Full access</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Taskome currently exposes one development scope.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="api-key-expiration">Expiration</FieldLabel>
                <Select
                  value={expiration}
                  onValueChange={(value) => value !== null && setExpiration(value)}
                >
                  <SelectTrigger id="api-key-expiration" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="30-days">30 days</SelectItem>
                      <SelectItem value="90-days">90 days</SelectItem>
                      <SelectItem value="1-year">1 year</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                Create API key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newSecret !== undefined}
        onOpenChange={(open) => {
          if (!open) setNewSecret(undefined);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Save your API key</DialogTitle>
            <DialogDescription>
              Copy this secret now. For your security, Taskome will not show it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-2xl border bg-muted/40 p-2 pl-3">
              <code className="min-w-0 flex-1 select-all truncate font-mono text-sm">
                {newSecret}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copySecret()}
                aria-label={copyStatus === "copied" ? "Copied" : "Copy API key"}
              >
                {copyStatus === "copied" ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <ClipboardIcon data-icon="inline-start" />
                )}
                {copyStatus === "copied" ? "Copied" : "Copy"}
              </Button>
            </div>
            {copyStatus === "failed" ? (
              <p role="alert" className="text-sm text-destructive">
                Copy failed. Select the key and copy it manually.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setNewSecret(undefined)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revokingKey !== undefined}
        onOpenChange={(open) => {
          if (!open) setRevokingKey(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke “{revokingKey?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Any client using this key will lose access immediately. Its safe metadata will remain
              visible in this list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={revokeApiKey}>
              <Trash2Icon data-icon="inline-start" />
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
