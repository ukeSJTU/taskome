import { Button } from "@taskome/ui/components/button";
import { DownloadIcon, ExpandIcon, RotateCcwIcon } from "lucide-react";
import * as React from "react";

import { StructureViewerError } from "./structure-viewer-adapter";
import type {
  StructureAppearance,
  StructureSource,
  StructureStatistics,
  StructureViewerAdapter,
  StructureViewerErrorKind,
  StructureViewerSession,
} from "./structure-viewer-adapter";

export function StructureViewer({
  adapter,
  onError,
  onReady,
  source,
}: {
  adapter: StructureViewerAdapter;
  onError?: (error: { kind: StructureViewerErrorKind; source: StructureSource }) => void;
  onReady?: (statistics: StructureStatistics) => void;
  source: StructureSource;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const sessionRef = React.useRef<StructureViewerSession | undefined>(undefined);
  const [session, setSession] = React.useState<StructureViewerSession>();
  const onErrorRef = React.useRef(onError);
  const onReadyRef = React.useRef(onReady);
  const sourceRef = React.useRef(source);
  const requestRef = React.useRef(0);
  const [appearance, setAppearance] = React.useState<StructureAppearance>({
    coloring: "chain",
    representation: "automatic",
  });
  const [statistics, setStatistics] = React.useState<StructureStatistics>();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [errorKind, setErrorKind] = React.useState<StructureViewerErrorKind>();
  const [retryVersion, setRetryVersion] = React.useState(0);
  const appearanceRef = React.useRef(appearance);

  React.useEffect(() => {
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
    sourceRef.current = source;
    appearanceRef.current = appearance;
  }, [appearance, onError, onReady, source]);

  const load = React.useCallback(async () => {
    const request = ++requestRef.current;
    setStatus("loading");
    setErrorKind(undefined);
    setStatistics(undefined);
    try {
      if (!session) throw new Error("Viewer initialization is incomplete.");
      session.cancel();
      await session.clear();
      const nextStatistics = await session.load(source);
      await session.setAppearance(appearanceRef.current);
      if (request !== requestRef.current) return;
      setStatistics(nextStatistics);
      setStatus("ready");
      onReadyRef.current?.(nextStatistics);
    } catch (error) {
      if (request !== requestRef.current) return;
      setStatus("error");
      const kind = error instanceof StructureViewerError ? error.kind : "parse";
      setErrorKind(kind);
      onErrorRef.current?.({ kind, source });
    }
  }, [session, source]);

  React.useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        if (!containerRef.current) return;
        const session = await adapter.create(containerRef.current);
        if (!active) {
          session.dispose();
          return;
        }
        sessionRef.current = session;
        setSession(session);
      } catch (error) {
        if (!active) return;
        setStatus("error");
        const kind = error instanceof StructureViewerError ? error.kind : "initialization";
        setErrorKind(kind);
        onErrorRef.current?.({ kind, source: sourceRef.current });
      }
    };
    void initialize();
    return () => {
      active = false;
      requestRef.current += 1;
      sessionRef.current?.dispose();
      sessionRef.current = undefined;
    };
  }, [adapter, retryVersion]);

  React.useEffect(() => {
    if (!session) return;
    void Promise.resolve().then(load);
  }, [load, session]);

  const updateAppearance = async (nextAppearance: StructureAppearance) => {
    setAppearance(nextAppearance);
    try {
      await sessionRef.current?.setAppearance(nextAppearance);
    } catch (error) {
      const kind = error instanceof StructureViewerError ? error.kind : "render";
      setStatus("error");
      setErrorKind(kind);
      onErrorRef.current?.({ kind, source });
    }
  };

  const retry = () => {
    if (errorKind === "initialization") {
      setRetryVersion((current) => current + 1);
      return;
    }
    void load();
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Structure Viewer">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Structure Viewer</h1>
          <p className="text-sm text-muted-foreground">
            {source.name} · {source.format.toUpperCase()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sessionRef.current?.resetCamera()}
            aria-label="Reset camera"
          >
            <RotateCcwIcon />
            Reset camera
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sessionRef.current?.screenshot(source.name)}
            aria-label="Download PNG"
          >
            <DownloadIcon />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void sessionRef.current?.toggleFullscreen()}
            aria-label="Toggle fullscreen"
          >
            <ExpandIcon />
            Fullscreen
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm font-medium">
          Representation
          <select
            aria-label="Representation"
            className="ml-2 rounded-md border bg-background p-1"
            value={appearance.representation}
            onChange={(event) =>
              void updateAppearance({
                ...appearance,
                representation: event.target.value as StructureAppearance["representation"],
              })
            }
          >
            <option value="automatic">Automatic</option>
            <option value="cartoon">Cartoon</option>
            <option value="ball-and-stick">Ball-and-stick</option>
            <option value="surface">Surface</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Coloring
          <select
            aria-label="Coloring"
            className="ml-2 rounded-md border bg-background p-1"
            value={appearance.coloring}
            onChange={(event) =>
              void updateAppearance({
                ...appearance,
                coloring: event.target.value as StructureAppearance["coloring"],
              })
            }
          >
            <option value="chain">Chain</option>
            <option value="element">Element</option>
            <option value="secondary-structure">Secondary structure</option>
          </select>
        </label>
      </div>
      <div
        className="relative min-h-96 overflow-hidden rounded-xl border bg-muted"
        ref={containerRef}
        aria-label="Molecular structure viewport"
      />
      <div aria-live="polite" className="text-sm">
        {status === "loading" ? "Loading structure…" : null}
        {status === "ready" ? "Ready" : null}
        {status === "error" ? (
          <>
            <p>
              {errorKind === "webgl-unavailable"
                ? "WebGL is unavailable in this browser, so Taskome cannot render this structure."
                : "Unable to load this structure."}
            </p>
            {errorKind !== "webgl-unavailable" ? (
              <Button size="sm" onClick={retry}>
                Retry
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {statistics ? (
        <p className="text-sm text-muted-foreground">
          {statistics.models} model{statistics.models === 1 ? "" : "s"} · {statistics.chains} chain
          {statistics.chains === 1 ? "" : "s"} · {statistics.residues} residues · {statistics.atoms}{" "}
          atoms
        </p>
      ) : null}
    </section>
  );
}
