import { Button } from "@taskome/ui/components/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@taskome/ui/components/alert-dialog";

import type { ManagedApiKey } from "./api-key";

export function RevokeApiKeyDialog({
  keyToRevoke,
  isRevoking,
  onOpenChange,
  onRevoke,
}: {
  keyToRevoke: ManagedApiKey | null;
  isRevoking: boolean;
  onOpenChange: (open: boolean) => void;
  onRevoke: () => void;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={keyToRevoke !== null}>
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <div className="flex flex-col gap-1.5">
            <AlertDialogTitle>Revoke {keyToRevoke?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This key will stop working immediately and cannot be restored.
            </AlertDialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button disabled={isRevoking} onClick={onRevoke} type="button" variant="destructive">
              {isRevoking ? "Revoking…" : "Revoke permanently"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
