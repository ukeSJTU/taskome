import { StructureViewerPanel } from "./_components/structure-viewer-panel";

export default function StructureViewerPage() {
  return (
    <section className="px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Structure Viewer</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a local PDB or mmCIF structure without uploading it to Taskome.
        </p>
      </div>
      <StructureViewerPanel />
    </section>
  );
}
