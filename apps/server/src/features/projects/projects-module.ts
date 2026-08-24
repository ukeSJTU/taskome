import type { Database } from "@/db/database";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { DatabaseError } from "pg";
import { z } from "zod";
import {
  DefaultProjectImmutableError,
  InvalidProjectCursorError,
  ProjectArchivedError,
  ProjectNameConflictError,
  ProjectNotEmptyError,
  ProjectNotFoundError,
} from "./project-errors";
import { normalizeProjectText, projectNameKey } from "./project-name";
import {
  deleteProjectById,
  findProjectById,
  findProjects,
  insertProject,
  setProjectArchivedAt,
  updateActiveProject,
} from "./projects-repository";

const ProjectCursorSchema = z.object({
  id: z.uuid(),
  isDefault: z.boolean(),
  nameKey: z.string(),
});

function decodeProjectCursor(cursor: string | undefined) {
  if (!cursor) return undefined;

  try {
    return ProjectCursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    throw new InvalidProjectCursorError();
  }
}

function encodeProjectCursor(project: { id: string; isDefault: boolean; nameKey: string }) {
  return Buffer.from(JSON.stringify(ProjectCursorSchema.parse(project))).toString("base64url");
}

function isProjectNameConflict(error: unknown) {
  return (
    error instanceof DrizzleQueryError &&
    error.cause instanceof DatabaseError &&
    error.cause.code === "23505" &&
    error.cause.constraint === "projects_owner_name_key_uidx"
  );
}

interface ProjectView {
  archivedAt: null | string;
  createdAt: string;
  description: null | string;
  id: string;
  isDefault: boolean;
  name: string;
  status: "active" | "archived";
  updatedAt: string;
}

function toProjectView(project: {
  archivedAt: Date | null;
  createdAt: Date;
  description: null | string;
  id: string;
  isDefault: boolean;
  name: string;
  updatedAt: Date;
}): ProjectView {
  return {
    archivedAt: project.archivedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    description: project.description,
    id: project.id,
    isDefault: project.isDefault,
    name: project.name,
    status: project.archivedAt ? "archived" : "active",
    updatedAt: project.updatedAt.toISOString(),
  };
}

export interface ProjectsModule {
  archiveProject(ownerUserId: string, projectId: string): Promise<ProjectView>;
  createProject(
    ownerUserId: string,
    input: { description?: null | string | undefined; name: string },
  ): Promise<ProjectView>;
  deleteProject(ownerUserId: string, projectId: string): Promise<void>;
  getProject(ownerUserId: string, projectId: string): Promise<ProjectView>;
  listProjects(
    ownerUserId: string,
    query: {
      cursor?: string | undefined;
      limit: number;
      status: "active" | "all" | "archived";
    },
  ): Promise<{
    items: ProjectView[];
    nextCursor: null | string;
  }>;
  updateProject(
    ownerUserId: string,
    projectId: string,
    input: { description?: null | string | undefined; name?: string | undefined },
  ): Promise<ProjectView>;
  unarchiveProject(ownerUserId: string, projectId: string): Promise<ProjectView>;
}

export function createProjectsModule(database: Database): ProjectsModule {
  return {
    async archiveProject(ownerUserId, projectId) {
      const current = await findProjectById(database, ownerUserId, projectId);
      if (!current) throw new ProjectNotFoundError();
      if (current.isDefault) {
        throw new DefaultProjectImmutableError("The Default Project cannot be archived.");
      }
      if (current.archivedAt) return toProjectView(current);

      const updated = await setProjectArchivedAt(database, ownerUserId, projectId, new Date());
      if (!updated) throw new ProjectNotFoundError();
      return toProjectView(updated);
    },
    async createProject(ownerUserId, input) {
      const name = normalizeProjectText(input.name);
      const description = input.description
        ? normalizeProjectText(input.description) || null
        : null;
      try {
        const created = await insertProject(database, {
          description,
          name,
          nameKey: projectNameKey(name),
          ownerUserId,
        });
        return toProjectView(created);
      } catch (error) {
        if (isProjectNameConflict(error)) {
          throw new ProjectNameConflictError();
        }
        throw error;
      }
    },
    async deleteProject(ownerUserId, projectId) {
      const current = await findProjectById(database, ownerUserId, projectId);
      if (!current) throw new ProjectNotFoundError();
      if (current.isDefault) {
        throw new DefaultProjectImmutableError("The Default Project cannot be deleted.");
      }

      try {
        const deleted = await deleteProjectById(database, ownerUserId, projectId);
        if (!deleted) throw new ProjectNotFoundError();
      } catch (error) {
        if (
          error instanceof DrizzleQueryError &&
          error.cause instanceof DatabaseError &&
          error.cause.code === "23503"
        ) {
          throw new ProjectNotEmptyError();
        }
        throw error;
      }
    },
    async getProject(ownerUserId, projectId) {
      const found = await findProjectById(database, ownerUserId, projectId);
      if (!found) throw new ProjectNotFoundError();
      return toProjectView(found);
    },
    async listProjects(ownerUserId, query) {
      const projects = await findProjects(
        database,
        ownerUserId,
        query.status,
        query.limit + 1,
        decodeProjectCursor(query.cursor),
      );
      const page = projects.slice(0, query.limit);
      const last = page.at(-1);

      return {
        items: page.map(toProjectView),
        nextCursor: projects.length > query.limit && last ? encodeProjectCursor(last) : null,
      };
    },
    async updateProject(ownerUserId, projectId, input) {
      const current = await findProjectById(database, ownerUserId, projectId);
      if (!current) throw new ProjectNotFoundError();
      if (current.archivedAt) throw new ProjectArchivedError();
      if (current.isDefault && input.name !== undefined) {
        throw new DefaultProjectImmutableError("The Default Project name cannot be changed.");
      }

      const name = input.name === undefined ? undefined : normalizeProjectText(input.name);
      const description =
        input.description === undefined
          ? undefined
          : input.description
            ? normalizeProjectText(input.description) || null
            : null;

      try {
        const updated = await updateActiveProject(database, ownerUserId, projectId, {
          ...(description === undefined ? {} : { description }),
          ...(name === undefined ? {} : { name, nameKey: projectNameKey(name) }),
        });
        if (!updated) throw new ProjectNotFoundError();
        return toProjectView(updated);
      } catch (error) {
        if (isProjectNameConflict(error)) {
          throw new ProjectNameConflictError();
        }
        throw error;
      }
    },
    async unarchiveProject(ownerUserId, projectId) {
      const current = await findProjectById(database, ownerUserId, projectId);
      if (!current) throw new ProjectNotFoundError();
      if (!current.archivedAt) return toProjectView(current);

      const updated = await setProjectArchivedAt(database, ownerUserId, projectId, null);
      if (!updated) throw new ProjectNotFoundError();
      return toProjectView(updated);
    },
  };
}
