"use client";

import * as React from "react";

import {
  type MolstarAdapter,
  type StructurePayload,
  createMolstarAdapter,
} from "./structure-viewer-molstar-adapter";
import type {
  StructureAppearance,
  StructureFormat,
  StructureReady,
  StructureSource,
  StructureViewerError,
  StructureViewerErrorCode,
} from "./structure-viewer-types";

export type {
  StructureAppearance,
  StructureFormat,
  StructureReady,
  StructureSource,
  StructureViewerError,
};

export type StructureViewerProps = {
  source?: StructureSource;
  label?: string;
  onReady?: (ready: StructureReady) => void;
  onError?: (error: StructureViewerError) => void;
};

const messages: Record<StructureViewerErrorCode, string> = {
  "format-required": "Structure format is required. Use a PDB or mmCIF file.",
  "unsupported-format": "This structure format is not supported. Use PDB or mmCIF.",
  "download-failed": "The structure could not be downloaded. Check access and try again.",
  "file-read-failed": "The selected file could not be read. Choose it again and retry.",
  "parse-failed": "The structure could not be parsed. Check that the file is valid.",
  "webgl-unavailable": "WebGL is unavailable in this browser.",
  "initialization-failed": "The structure viewer could not start. Try again.",
  "render-failed": "The structure could not be rendered. Try again.",
};

function formatFromName(name?: string) {
  const extension = name?.split(".").pop()?.toLowerCase();
  if (extension === "pdb" || extension === "ent") return "pdb";
  if (extension === "cif" || extension === "mmcif") return "mmcif";
  return undefined;
}

function inferFormat(source: StructureSource): StructureFormat | undefined {
  if (source.format) return source.format;
  if ("file" in source) return formatFromName(source.name ?? source.file.name);
  if ("url" in source) return formatFromName(source.name ?? new URL(source.url).pathname);
  return formatFromName(source.name);
}

function publicError(code: StructureViewerErrorCode, status?: number): StructureViewerError {
  return {
    code,
    message: messages[code],
    retryable: code !== "format-required" && code !== "unsupported-format",
    status,
  };
}

async function readSource(
  source: StructureSource,
  signal: AbortSignal,
): Promise<string | Uint8Array> {
  if ("data" in source) return source.data;
  if ("file" in source) return source.file.text();
  const response = await fetch(source.url, { signal });
  if (!response.ok) throw Object.assign(new Error("download"), { status: response.status });
  return response.text();
}

export function StructureViewer({ source, label, onReady, onError }: StructureViewerProps) {
  const container = React.useRef<HTMLDivElement>(null);
  // TODO: Verify instance isolation, focus-scoped keyboard actions, fullscreen ownership,
  // concurrent source replacement, and WebGL/GPU cleanup before claiming same-page multi-viewer support.
  const adapter = React.useRef<MolstarAdapter | undefined>(undefined);
  const generation = React.useRef(0);
  const [state, setState] = React.useState<"empty" | "loading" | "ready" | "error">("empty");
  const [error, setError] = React.useState<StructureViewerError>();
  const [attempt, setAttempt] = React.useState(0);
  const [appearance, setAppearance] = React.useState<StructureAppearance>({
    representation: "automatic",
    coloring: "chain",
  });
  const [fullscreenAvailable, setFullscreenAvailable] = React.useState(false);

  React.useEffect(() => {
    setFullscreenAvailable(
      typeof document !== "undefined" && "requestFullscreen" in document.documentElement,
    );
  }, []);

  React.useEffect(() => {
    if (!container.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => adapter.current?.resize());
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!source) {
      setState("empty");
      return;
    }
    const format = inferFormat(source);
    if (!format) {
      const nextError = publicError("format-required");
      setError(nextError);
      setState("error");
      onError?.(nextError);
      return;
    }

    const controller = new AbortController();
    const currentGeneration = ++generation.current;
    setState("loading");
    setError(undefined);
    void (async () => {
      try {
        await adapter.current?.clear();
        if (controller.signal.aborted || currentGeneration !== generation.current) return;
        const data = await readSource(source, controller.signal);
        if (
          controller.signal.aborted ||
          currentGeneration !== generation.current ||
          !container.current
        )
          return;
        adapter.current ??= await createMolstarAdapter(container.current);
        const payload: StructurePayload = {
          data,
          format,
          name: source.name ?? ("file" in source ? source.file.name : undefined),
        };
        const ready = await adapter.current.load(payload);
        if (controller.signal.aborted || currentGeneration !== generation.current) return;
        setState("ready");
        onReady?.(ready);
      } catch (cause) {
        if (controller.signal.aborted || currentGeneration !== generation.current) return;
        const status =
          cause && typeof cause === "object" && "status" in cause
            ? Number(cause.status)
            : undefined;
        const code: StructureViewerErrorCode = status
          ? "download-failed"
          : cause instanceof Error && cause.message.includes("file read")
            ? "file-read-failed"
            : cause instanceof Error && cause.message.includes("WebGL")
              ? "webgl-unavailable"
              : "parse-failed";
        const nextError = publicError(code, status);
        setError(nextError);
        setState("error");
        onError?.(nextError);
      }
    })();
    return () => controller.abort();
  }, [source?.key, attempt, onError, onReady]);

  React.useEffect(
    () => () => {
      generation.current += 1;
      adapter.current?.dispose();
    },
    [],
  );

  const changeAppearance = async (next: Partial<StructureAppearance>) => {
    const previous = appearance;
    const updated = { ...appearance, ...next };
    setAppearance(updated);
    try {
      await adapter.current?.setAppearance(updated);
    } catch {
      setAppearance(previous);
      const nextError = publicError("render-failed");
      setError(nextError);
      setState("error");
      onError?.(nextError);
    }
  };

  const fileName = source?.name ?? (source && "file" in source ? source.file.name : "structure");
  return (
    <section
      aria-label={label ?? fileName ?? "Protein structure viewer"}
      className="overflow-hidden rounded-lg border bg-card"
    >
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <label className="sr-only" htmlFor="structure-representation">
          Representation
        </label>
        <select
          id="structure-representation"
          value={appearance.representation}
          onChange={(event) =>
            void changeAppearance({
              representation: event.target.value as StructureAppearance["representation"],
            })
          }
          disabled={state !== "ready"}
          className="rounded border bg-background px-2 py-1 text-sm"
        >
          <option value="automatic">Automatic</option>
          <option value="cartoon">Cartoon</option>
          <option value="ball-and-stick">Ball &amp; Stick</option>
          <option value="surface">Surface</option>
        </select>
        <label className="sr-only" htmlFor="structure-coloring">
          Coloring
        </label>
        <select
          id="structure-coloring"
          value={appearance.coloring}
          onChange={(event) =>
            void changeAppearance({
              coloring: event.target.value as StructureAppearance["coloring"],
            })
          }
          disabled={state !== "ready"}
          className="rounded border bg-background px-2 py-1 text-sm"
        >
          <option value="chain">Chain</option>
          <option value="element">Element</option>
          <option value="secondary-structure">Secondary Structure</option>
        </select>
        <button
          type="button"
          onClick={() => adapter.current?.resetCamera()}
          disabled={state !== "ready"}
          className="rounded border px-2 py-1 text-sm"
        >
          Reset camera
        </button>
        <button
          type="button"
          onClick={() =>
            void adapter.current?.screenshot(`${fileName.replace(/\.[^.]+$/, "")}.png`)
          }
          disabled={state !== "ready"}
          className="rounded border px-2 py-1 text-sm"
        >
          Download PNG
        </button>
        {fullscreenAvailable && (
          <button
            type="button"
            onClick={() => void container.current?.parentElement?.requestFullscreen()}
            disabled={state !== "ready"}
            className="rounded border px-2 py-1 text-sm"
          >
            Fullscreen
          </button>
        )}
      </div>
      <div ref={container} className="relative min-h-96 bg-muted/30">
        {state === "empty" && (
          <div className="flex min-h-96 items-center justify-center p-6 text-center">
            <div>
              <h2 className="text-lg font-semibold">Protein structure viewer</h2>
              <p role="status" className="mt-2 text-sm text-muted-foreground">
                Choose a structure file to begin
              </p>
            </div>
          </div>
        )}
        {state === "loading" && (
          <p
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm"
          >
            Loading structure…
          </p>
        )}
        {state === "ready" && (
          <p role="status" aria-live="polite" className="sr-only">
            Structure ready
          </p>
        )}
        {state === "error" && error && (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-6 text-center"
          >
            <p>{error.message}</p>
            {error.retryable && (
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
