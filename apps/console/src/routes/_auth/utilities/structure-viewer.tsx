import { createFileRoute } from "@tanstack/react-router";

import { StructureViewerPage } from "@/components/structure-viewer/structure-viewer-page";

export const Route = createFileRoute("/_auth/utilities/structure-viewer")({
  component: StructureViewerPage,
});
