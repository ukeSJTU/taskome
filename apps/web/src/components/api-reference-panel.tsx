"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@taskome/ui/components/button";
import { Skeleton } from "@taskome/ui/components/skeleton";

type Projection = Record<string, unknown>;
type ReferenceState =
  | { status: "loading" }
  | { status: "ready"; projection: Projection }
  | { status: "error" };

export function ApiReferencePanel() {
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState<ReferenceState>({ status: "loading" });

  const loadProjection = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/gateway/openapi", { cache: "no-store" });
      if (!response.ok) throw new Error("API reference request failed");
      const projection = (await response.json()) as Projection;
      setState({ projection, status: "ready" });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void loadProjection();
  }, [loadProjection]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b px-4 py-6 lg:px-8">
        <div className="max-w-3xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">API reference</h2>
          <p className="text-muted-foreground text-sm leading-6">
            The live REST contract for Direct API Clients. Authenticate requests with your Personal
            API Key in the <code className="text-foreground font-mono">X-API-Key</code> header.
          </p>
        </div>
      </div>

      {state.status === "loading" && (
        <div className="space-y-5 p-4 lg:p-8" role="status" aria-live="polite">
          <span className="sr-only">Loading API reference</span>
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex min-h-80 items-center justify-center p-6">
          <div className="max-w-md space-y-4 text-center" role="alert">
            <AlertCircleIcon className="text-muted-foreground mx-auto size-8" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="font-semibold">The API reference is temporarily unavailable</h3>
              <p className="text-muted-foreground text-sm leading-6">
                We could not load the running Gateway contract. Try again in a moment.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadProjection()}>
              <RefreshCwIcon aria-hidden="true" />
              Try again
            </Button>
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <div className="taskome-api-reference min-w-0 flex-1 overflow-x-auto">
          <ApiReferenceReact
            configuration={{
              agent: { disabled: true },
              content: state.projection,
              customCss: `
                .taskome-api-reference .scalar-app {
                  --scalar-font: inherit;
                  --scalar-background-1: var(--background);
                  --scalar-background-2: var(--muted);
                  --scalar-background-3: var(--accent);
                  --scalar-color-1: var(--foreground);
                  --scalar-color-2: var(--muted-foreground);
                  --scalar-color-3: var(--muted-foreground);
                  --scalar-border-color: var(--border);
                }
                .taskome-api-reference .references-layout {
                  min-height: 0;
                }
              `,
              forceDarkModeState: resolvedTheme === "dark" ? "dark" : "light",
              hideClientButton: true,
              hideDarkModeToggle: true,
              hideTestRequestButton: true,
              modelsSectionLabel: "Schemas",
              showDeveloperTools: "never",
              telemetry: false,
              theme: "none",
              withDefaultFonts: false,
            }}
          />
        </div>
      )}
    </div>
  );
}
