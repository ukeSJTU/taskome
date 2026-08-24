import { z } from "@hono/zod-openapi";

import { normalizeProjectText } from "./project-name";

const ProjectNameInputSchema = z
  .string()
  .trim()
  .min(1)
  .transform(normalizeProjectText)
  .refine((value) => [...value].length <= 100, "Project name must be at most 100 characters.")
  .meta({ maxLength: 100 });

const ProjectDescriptionInputSchema = z
  .string()
  .trim()
  .transform(normalizeProjectText)
  .refine(
    (value) => [...value].length <= 1000,
    "Project description must be at most 1000 characters.",
  )
  .meta({ maxLength: 1000 });

export const ProjectSchema = z
  .object({
    archivedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    description: z.string().nullable(),
    id: z.uuid(),
    isDefault: z.boolean(),
    name: z.string(),
    status: z.enum(["active", "archived"]),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Project");

export const ProjectListSchema = z
  .object({
    items: z.array(ProjectSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi("ProjectList");

export const CreateProjectSchema = z
  .object({
    description: ProjectDescriptionInputSchema.nullable().optional(),
    name: ProjectNameInputSchema,
  })
  .openapi("CreateProject");

export const UpdateProjectSchema = z
  .object({
    description: ProjectDescriptionInputSchema.nullable().optional(),
    name: ProjectNameInputSchema.optional(),
  })
  .refine((value) => value.description !== undefined || value.name !== undefined, {
    message: "At least one field must be provided.",
  })
  .openapi("UpdateProject");
