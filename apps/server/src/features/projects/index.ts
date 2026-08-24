import { OpenAPIHono } from "@hono/zod-openapi";

import { requireSession } from "@/auth/require-session";
import type { GetSession } from "@/auth/session";
import type { AppEnv } from "@/http/types";
import {
  createCreateProjectHandler,
  createArchiveProjectHandler,
  createGetProjectHandler,
  createDeleteProjectHandler,
  createListProjectsHandler,
  createUpdateProjectHandler,
  createUnarchiveProjectHandler,
} from "./project-handlers";
import type { ProjectsModule } from "./projects-module";
import {
  createProjectRoute,
  archiveProjectRoute,
  getProjectRoute,
  deleteProjectRoute,
  listProjectsRoute,
  updateProjectRoute,
  unarchiveProjectRoute,
} from "./projects-routes";

interface ProjectsRouterOptions {
  getSession: GetSession;
  projects: ProjectsModule;
}

export function createProjectsRouter({ getSession, projects }: ProjectsRouterOptions) {
  const router = new OpenAPIHono<AppEnv>();
  router.use("*", requireSession(getSession));
  router.openapi(archiveProjectRoute, createArchiveProjectHandler(projects));
  router.openapi(listProjectsRoute, createListProjectsHandler(projects));
  router.openapi(createProjectRoute, createCreateProjectHandler(projects));
  router.openapi(deleteProjectRoute, createDeleteProjectHandler(projects));
  router.openapi(getProjectRoute, createGetProjectHandler(projects));
  router.openapi(updateProjectRoute, createUpdateProjectHandler(projects));
  router.openapi(unarchiveProjectRoute, createUnarchiveProjectHandler(projects));
  return router;
}

export { createProjectsModule, type ProjectsModule } from "./projects-module";
