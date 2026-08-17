"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import type { StructureSource } from "@/components/structure-viewer";

const StructureViewer = dynamic(
  () => import("@/components/structure-viewer").then((module) => module.StructureViewer),
  {
    ssr: false,
    loading: () => <div className="min-h-96 animate-pulse rounded-lg border bg-muted/30" />,
  },
);

const supportedExtensions = ["pdb", "ent", "cif", "mmcif"];

function accepts(file: File) {
  return supportedExtensions.includes(file.name.split(".").pop()?.toLowerCase() ?? "");
}

function fileSize(bytes: number) {
  return new Intl.NumberFormat("en", { style: "unit", unit: "byte", unitDisplay: "short" }).format(
    bytes,
  );
}

export function StructureViewerPanel() {
  const input = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File>();
  const [message, setMessage] = React.useState<string>();
  const source: StructureSource | undefined = file && {
    key: `${file.name}:${file.size}:${file.lastModified}`,
    file,
  };
  const selectFile = (candidate?: File) => {
    if (!candidate) return;
    if (!accepts(candidate)) {
      setMessage("Choose a PDB (.pdb, .ent) or mmCIF (.cif, .mmcif) file.");
      return;
    }
    setMessage(undefined);
    setFile(candidate);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="space-y-4">
        <div
          className="rounded-lg border border-dashed p-5 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            selectFile(event.dataTransfer.files[0]);
          }}
        >
          <p className="font-medium">Drop a structure file here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            PDB or mmCIF. Files stay in your browser.
          </p>
          <input
            ref={input}
            type="file"
            accept=".pdb,.ent,.cif,.mmcif"
            className="sr-only"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className="mt-4 rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
            onClick={() => input.current?.click()}
          >
            Choose file
          </button>
        </div>
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
        {file && (
          <dl className="rounded-lg border p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">File</dt>
              <dd className="font-medium break-all">{file.name}</dd>
            </div>
            <div className="mt-3">
              <dt className="text-muted-foreground">Size</dt>
              <dd>{fileSize(file.size)}</dd>
            </div>
            <div className="mt-3">
              <dt className="text-muted-foreground">Format</dt>
              <dd>{file.name.split(".").pop()?.toUpperCase()}</dd>
            </div>
          </dl>
        )}
      </div>
      <StructureViewer source={source} />
    </div>
  );
}
