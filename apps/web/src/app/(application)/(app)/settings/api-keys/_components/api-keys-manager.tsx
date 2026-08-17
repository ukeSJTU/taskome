"use client";

import { createContext, useCallback, useContext, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { FieldError } from "@taskome/ui/components/field";

import type { ManagedApiKey } from "./api-key";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { RevokeApiKeyDialog } from "./revoke-api-key-dialog";

type ApiKeysContextValue = {
  keys: ManagedApiKey[] | null;
  pendingKeyId: string | null;
  requestRevoke: (key: ManagedApiKey) => void;
  setInitialKeys: (keys: ManagedApiKey[]) => void;
};

const ApiKeysContext = createContext<ApiKeysContextValue | null>(null);

function filterEnabledKeys(keys: ManagedApiKey[]) {
  return keys.filter((key) => key.enabled);
}

export function useApiKeys() {
  const context = useContext(ApiKeysContext);
  if (!context) throw new Error("useApiKeys must be used within ApiKeysManager.");
  return context;
}

export function ApiKeysManager({ children }: { children: React.ReactNode }) {
  const [keys, setKeys] = useState<ManagedApiKey[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingKeyId, setPendingKeyId] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ManagedApiKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setInitialKeys = useCallback((initialKeys: ManagedApiKey[]) => {
    setKeys(filterEnabledKeys(initialKeys));
  }, []);

  async function loadKeys() {
    const result = await authClient.apiKey.list({
      query: { sortBy: "createdAt", sortDirection: "desc" },
    });
    if (result.error) {
      setError("We couldn't load your API keys. Try again.");
      return false;
    }

    setKeys(filterEnabledKeys(result.data.apiKeys));
    return true;
  }

  async function createKey(name: string) {
    setIsCreating(true);
    setError(null);
    const result = await authClient.apiKey.create({ name });
    if (result.error) {
      setError(result.error.message || "We couldn't create the API key. Try again.");
      setIsCreating(false);
      return null;
    }

    await loadKeys();
    setIsCreating(false);
    return result.data.key;
  }

  async function revokeKey() {
    if (!keyToRevoke) return;
    setPendingKeyId(keyToRevoke.id);
    setError(null);
    const result = await authClient.apiKey.update({ enabled: false, keyId: keyToRevoke.id });
    if (result.error) {
      setError(result.error.message || `We couldn't revoke ${keyToRevoke.name}. Try again.`);
      setPendingKeyId(null);
      return;
    }

    await loadKeys();
    setPendingKeyId(null);
    setKeyToRevoke(null);
  }

  return (
    <ApiKeysContext
      value={{
        keys,
        pendingKeyId,
        requestRevoke: setKeyToRevoke,
        setInitialKeys,
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <CreateApiKeyDialog error={error} isCreating={isCreating} onCreate={createKey} />
        </div>
        {children}
        <FieldError errors={error ? [{ message: error }] : []} />
      </div>
      <RevokeApiKeyDialog
        isRevoking={pendingKeyId !== null}
        keyToRevoke={keyToRevoke}
        onOpenChange={(open) => {
          if (!open && !pendingKeyId) setKeyToRevoke(null);
        }}
        onRevoke={() => void revokeKey()}
      />
    </ApiKeysContext>
  );
}
