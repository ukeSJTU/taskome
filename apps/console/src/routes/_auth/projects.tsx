import { createFileRoute } from "@tanstack/react-router";

import { ProjectsPage } from "@/components/projects/projects-page";

export const Route = createFileRoute("/_auth/projects")({
  component: ProjectsPage,
});
