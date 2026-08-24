import type { RouteHandler } from "@hono/zod-openapi";
import type { Context } from "hono";

import type { AppEnv } from "@/http/types";
import { problemDetails } from "@/http/errors/problem";
import {
  DefaultProjectImmutableError,
  InvalidProjectCursorError,
  ProjectArchivedError,
  ProjectNameConflictError,
  ProjectNotEmptyError,
  ProjectNotFoundError,
} from "./project-errors";
import type { ProjectsModule } from "./projects-module";
import type {
  CreateProjectRoute,
  GetProjectRoute,
  ListProjectsRoute,
  UpdateProjectRoute,
  ArchiveProjectRoute,
  UnarchiveProjectRoute,
  DeleteProjectRoute,
} from "./projects-routes";

function projectProblem<TStatus extends 404 | 409 | 422>(
  c: Context<AppEnv>,
  options: { code: string; detail: string; status: TStatus; title: string },
) {
  return c.json(problemDetails(c, options), options.status, {
    "content-type": "application/problem+json; charset=UTF-8",
  });
}

function projectNotFound(c: Context<AppEnv>, error: ProjectNotFoundError) {
  return projectProblem(c, {
    code: "project_not_found",
    detail: error.message,
    status: 404,
    title: "Project not found",
  });
}

function projectNameConflict(c: Context<AppEnv>, error: ProjectNameConflictError) {
  return projectProblem(c, {
    code: "project_name_conflict",
    detail: error.message,
    status: 409,
    title: "Project name already exists",
  });
}

function defaultProjectImmutable(c: Context<AppEnv>, error: DefaultProjectImmutableError) {
  return projectProblem(c, {
    code: "default_project_immutable",
    detail: error.message,
    status: 409,
    title: "Default Project is immutable",
  });
}

export function createDeleteProjectHandler(
  projects: ProjectsModule,
): RouteHandler<DeleteProjectRoute, AppEnv> {
  return async (c) => {
    try {
      await projects.deleteProject(c.get("session").user.id, c.req.valid("param").projectId);
      return c.body(null, 204);
    } catch (error) {
      if (error instanceof DefaultProjectImmutableError) {
        return defaultProjectImmutable(c, error);
      }
      if (error instanceof ProjectNotEmptyError) {
        return projectProblem(c, {
          code: "project_not_empty",
          detail: error.message,
          status: 409,
          title: "Project is not empty",
        });
      }
      if (error instanceof ProjectNotFoundError) {
        return projectNotFound(c, error);
      }
      throw error;
    }
  };
}

export function createArchiveProjectHandler(
  projects: ProjectsModule,
): RouteHandler<ArchiveProjectRoute, AppEnv> {
  return async (c) => {
    try {
      const archived = await projects.archiveProject(
        c.get("session").user.id,
        c.req.valid("param").projectId,
      );
      return c.json(archived, 200);
    } catch (error) {
      if (error instanceof DefaultProjectImmutableError) {
        return defaultProjectImmutable(c, error);
      }
      if (error instanceof ProjectNotFoundError) {
        return projectNotFound(c, error);
      }
      throw error;
    }
  };
}

export function createUnarchiveProjectHandler(
  projects: ProjectsModule,
): RouteHandler<UnarchiveProjectRoute, AppEnv> {
  return async (c) => {
    try {
      const unarchived = await projects.unarchiveProject(
        c.get("session").user.id,
        c.req.valid("param").projectId,
      );
      return c.json(unarchived, 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        return projectNotFound(c, error);
      }
      throw error;
    }
  };
}

export function createUpdateProjectHandler(
  projects: ProjectsModule,
): RouteHandler<UpdateProjectRoute, AppEnv> {
  return async (c) => {
    try {
      const updated = await projects.updateProject(
        c.get("session").user.id,
        c.req.valid("param").projectId,
        c.req.valid("json"),
      );
      return c.json(updated, 200);
    } catch (error) {
      if (error instanceof DefaultProjectImmutableError) {
        return defaultProjectImmutable(c, error);
      }
      if (error instanceof ProjectArchivedError) {
        return projectProblem(c, {
          code: "project_archived",
          detail: error.message,
          status: 409,
          title: "Project is archived",
        });
      }
      if (error instanceof ProjectNameConflictError) {
        return projectNameConflict(c, error);
      }
      if (error instanceof ProjectNotFoundError) {
        return projectNotFound(c, error);
      }
      throw error;
    }
  };
}

export function createGetProjectHandler(
  projects: ProjectsModule,
): RouteHandler<GetProjectRoute, AppEnv> {
  return async (c) => {
    try {
      const project = await projects.getProject(
        c.get("session").user.id,
        c.req.valid("param").projectId,
      );
      return c.json(project, 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        return projectNotFound(c, error);
      }
      throw error;
    }
  };
}

export function createCreateProjectHandler(
  projects: ProjectsModule,
): RouteHandler<CreateProjectRoute, AppEnv> {
  return async (c) => {
    try {
      const created = await projects.createProject(c.get("session").user.id, c.req.valid("json"));
      c.header("location", `/api/v1/projects/${created.id}`);
      return c.json(created, 201);
    } catch (error) {
      if (error instanceof ProjectNameConflictError) {
        return projectNameConflict(c, error);
      }
      throw error;
    }
  };
}

export function createListProjectsHandler(
  projects: ProjectsModule,
): RouteHandler<ListProjectsRoute, AppEnv> {
  return async (c) => {
    try {
      const result = await projects.listProjects(c.get("session").user.id, c.req.valid("query"));
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof InvalidProjectCursorError) {
        return projectProblem(c, {
          code: "invalid_project_cursor",
          detail: error.message,
          status: 422,
          title: "Invalid Project cursor",
        });
      }
      throw error;
    }
  };
}
