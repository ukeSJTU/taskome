import { createRoute, z } from "@hono/zod-openapi";
import jsonContent from "stoker/openapi/helpers/json-content";
import * as HttpStatusCodes from "stoker/http-status-codes";

import { ProblemDetailsSchema } from "@/http/errors/problem";
import {
  CreateProjectSchema,
  ProjectListSchema,
  ProjectSchema,
  UpdateProjectSchema,
} from "./projects-schemas";

const ProjectParamsSchema = z.object({ projectId: z.uuid() });
const ProjectListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["active", "archived", "all"]).default("active"),
});

export const archiveProjectRoute = createRoute({
  description: "Archive a regular Project without changing its contents.",
  method: "post",
  operationId: "archiveProject",
  path: "/projects/{projectId}/archive",
  request: { params: ProjectParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(ProjectSchema, "Archived Project"),
    [HttpStatusCodes.CONFLICT]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Default Project cannot be archived",
    },
    [HttpStatusCodes.NOT_FOUND]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project does not exist for this user",
    },
    [HttpStatusCodes.UNAUTHORIZED]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request has no valid session",
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project ID is invalid",
    },
  },
  security: [{ cookieAuth: [] }],
  tags: ["Projects"],
});

export const unarchiveProjectRoute = createRoute({
  description: "Restore an archived Project to active use.",
  method: "post",
  operationId: "unarchiveProject",
  path: "/projects/{projectId}/unarchive",
  request: { params: ProjectParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(ProjectSchema, "Active Project"),
    [HttpStatusCodes.NOT_FOUND]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project does not exist for this user",
    },
    [HttpStatusCodes.UNAUTHORIZED]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request has no valid session",
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project ID is invalid",
    },
  },
  security: [{ cookieAuth: [] }],
  tags: ["Projects"],
});

export const deleteProjectRoute = createRoute({
  description: "Permanently delete an empty regular Project.",
  method: "delete",
  operationId: "deleteProject",
  path: "/projects/{projectId}",
  request: { params: ProjectParamsSchema },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "The Project was deleted",
    },
    [HttpStatusCodes.CONFLICT]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project is the Default Project or is not empty",
    },
    [HttpStatusCodes.NOT_FOUND]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project does not exist for this user",
    },
    [HttpStatusCodes.UNAUTHORIZED]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request has no valid session",
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project ID is invalid",
    },
  },
  security: [{ cookieAuth: [] }],
  tags: ["Projects"],
});

export const getProjectRoute = createRoute({
  description: "Return one Project owned by the signed-in user.",
  method: "get",
  operationId: "getProject",
  path: "/projects/{projectId}",
  request: { params: ProjectParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(ProjectSchema, "Project"),
    [HttpStatusCodes.NOT_FOUND]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project does not exist for this user",
    },
    [HttpStatusCodes.UNAUTHORIZED]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request has no valid session",
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project ID is invalid",
    },
  },
  security: [{ cookieAuth: [] }],
  tags: ["Projects"],
});

export const updateProjectRoute = createRoute({
  description: "Update an active Project owned by the signed-in user.",
  method: "patch",
  operationId: "updateProject",
  path: "/projects/{projectId}",
  request: {
    body: {
      content: {
        "application/json": { schema: UpdateProjectSchema },
      },
      required: true,
    },
    params: ProjectParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(ProjectSchema, "Updated Project"),
    [HttpStatusCodes.CONFLICT]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The update conflicts with Project state or naming",
    },
    [HttpStatusCodes.NOT_FOUND]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The Project does not exist for this user",
    },
    [HttpStatusCodes.UNAUTHORIZED]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request has no valid session",
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request is invalid",
    },
  },
  security: [{ cookieAuth: [] }],
  tags: ["Projects"],
});

export const createProjectRoute = createRoute({
  description: "Create a private Project for the signed-in user.",
  method: "post",
  operationId: "createProject",
  path: "/projects",
  request: {
    body: {
      content: {
        "application/json": { schema: CreateProjectSchema },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(ProjectSchema, "Created Project"),
    [HttpStatusCodes.CONFLICT]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "A Project with the normalized name already exists",
    },
    [HttpStatusCodes.UNAUTHORIZED]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request has no valid session",
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request body is invalid",
    },
  },
  security: [{ cookieAuth: [] }],
  tags: ["Projects"],
});

export const listProjectsRoute = createRoute({
  description: "List the signed-in user's Projects, active by default.",
  method: "get",
  operationId: "listProjects",
  path: "/projects",
  request: { query: ProjectListQuerySchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(ProjectListSchema, "Projects"),
    [HttpStatusCodes.UNAUTHORIZED]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request has no valid session",
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The list query or cursor is invalid",
    },
  },
  security: [{ cookieAuth: [] }],
  tags: ["Projects"],
});

export type ListProjectsRoute = typeof listProjectsRoute;
export type CreateProjectRoute = typeof createProjectRoute;
export type GetProjectRoute = typeof getProjectRoute;
export type UpdateProjectRoute = typeof updateProjectRoute;
export type ArchiveProjectRoute = typeof archiveProjectRoute;
export type UnarchiveProjectRoute = typeof unarchiveProjectRoute;
export type DeleteProjectRoute = typeof deleteProjectRoute;
