import { Alert, AlertDescription, AlertTitle } from "@taskome/ui/components/alert";
import { Button } from "@taskome/ui/components/button";
import { Input } from "@taskome/ui/components/input";
import { FileWarningIcon, UploadIcon } from "lucide-react";
import * as React from "react";

import { molstarAdapter } from "@/components/structure-viewer/molstar-adapter";
import type {
  StructureFormat,
  StructureSource,
} from "@/components/structure-viewer/structure-viewer-adapter";
import { StructureViewer } from "@/components/structure-viewer/structure-viewer";

const formatByExtension = {
  cif: "mmcif",
  ent: "pdb",
  mmcif: "mmcif",
  pdb: "pdb",
} as const satisfies Record<string, StructureFormat>;

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileFormat(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && extension in formatByExtension
    ? formatByExtension[extension as keyof typeof formatByExtension]
    : undefined;
}

export function StructureViewerPage() {
  const [error, setError] = React.useState<string>();
  const [source, setSource] = React.useState<StructureSource & { size: number }>();

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    const format = fileFormat(file);
    if (!format) {
      setSource(undefined);
      setError("Choose a PDB (.pdb or .ent) or mmCIF (.cif or .mmcif) file.");
      return;
    }
    try {
      const content = await file.text();
      setError(undefined);
      setSource({ content, format, id: crypto.randomUUID(), name: file.name, size: file.size });
    } catch {
      setSource(undefined);
      setError("Taskome could not read this local file. Please choose it again.");
    }
  };

  return (
    <main className="flex flex-1 flex-col px-4 py-8 md:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {source ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {formatFileSize(source.size)} · This file stays in your browser and is not uploaded
                or saved.
              </p>
              <Button variant="outline" onClick={() => setSource(undefined)}>
                <UploadIcon />
                Choose another file
              </Button>
            </div>
            <StructureViewer adapter={molstarAdapter} source={source} />
          </>
        ) : (
          <section className="rounded-xl border border-dashed p-10 text-center">
            <h1 className="text-2xl font-semibold">Structure Viewer</h1>
            <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
              Open a PDB or mmCIF structure directly from your device. Taskome reads it only in this
              browser; it is not uploaded, saved, or turned into a Job.
            </p>
            <label className="mt-6 inline-flex cursor-pointer">
              <Input
                className="sr-only"
                type="file"
                accept=".pdb,.ent,.cif,.mmcif"
                onChange={(event) => void selectFile(event.target.files?.[0])}
              />
              <span className="inline-flex h-8 items-center gap-1.5 rounded-2xl bg-primary px-3 text-sm font-medium text-primary-foreground">
                <UploadIcon className="size-4" />
                Choose structure file
              </span>
            </label>
          </section>
        )}
        {error ? (
          <Alert variant="destructive">
            <FileWarningIcon />
            <AlertTitle>Unsupported local file</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </main>
  );
}
