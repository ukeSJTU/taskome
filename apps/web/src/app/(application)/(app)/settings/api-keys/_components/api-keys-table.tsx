"use client";

import { KeyRoundIcon, ShieldOffIcon } from "lucide-react";
import { useEffect } from "react";

import { formatDate, type ManagedApiKey } from "./api-key";
import { useApiKeys } from "./api-keys-manager";
import { Button } from "@taskome/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@taskome/ui/components/empty";
import { Skeleton } from "@taskome/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taskome/ui/components/table";

export function ApiKeysTableSkeleton() {
  return (
    <div aria-label="Loading API keys" className="flex flex-col gap-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function ApiKeysTable({ initialKeys }: { initialKeys: ManagedApiKey[] }) {
  const { keys: refreshedKeys, pendingKeyId, requestRevoke, setInitialKeys } = useApiKeys();
  useEffect(() => setInitialKeys(initialKeys), [initialKeys, setInitialKeys]);
  const keys = refreshedKeys ?? initialKeys;
  if (keys.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRoundIcon />
          </EmptyMedia>
          <EmptyTitle>No active keys</EmptyTitle>
          <EmptyDescription>
            Create a key for each script or machine that needs API access.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Key preview</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last used</TableHead>
          <TableHead aria-label="Actions" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key.id}>
            <TableCell className="font-medium">{key.name}</TableCell>
            <TableCell>
              <code>{key.start ? `${key.start}…` : `${key.prefix ?? "taskome_"}…`}</code>
            </TableCell>
            <TableCell>{formatDate(key.createdAt)}</TableCell>
            <TableCell>{key.lastRequest ? formatDate(key.lastRequest) : "Never"}</TableCell>
            <TableCell className="text-right">
              <Button
                aria-label={`Revoke ${key.name}`}
                disabled={pendingKeyId === key.id}
                onClick={() => requestRevoke(key)}
                size="sm"
                type="button"
                variant="destructive"
              >
                <ShieldOffIcon data-icon="inline-start" />
                {pendingKeyId === key.id ? "Revoking…" : "Revoke"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
