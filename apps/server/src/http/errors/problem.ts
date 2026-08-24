import { z, type OpenAPIHonoOptions } from "@hono/zod-openapi";
import type { Context } from "hono";

import type { AppEnv } from "@/http/types";

export const ProblemDetailsSchema = z
  .object({
    code: z.string(),
    detail: z.string(),
    errors: z
      .array(
        z.object({
          code: z.string(),
          message: z.string(),
          path: z.string(),
        }),
      )
      .optional(),
    instance: z.string(),
    requestId: z.string(),
    status: z.number().int(),
    title: z.string(),
    type: z.string(),
  })
  .openapi("ProblemDetails");

interface ProblemOptions {
  code: string;
  detail: string;
  errors?: Array<{ code: string; message: string; path: string }>;
  status: number;
  title: string;
}

export function problemResponse(c: Context<AppEnv>, options: ProblemOptions) {
  return new Response(JSON.stringify(problemDetails(c, options)), {
    headers: { "content-type": "application/problem+json; charset=UTF-8" },
    status: options.status,
  });
}

export function problemDetails(c: Context<AppEnv>, options: ProblemOptions) {
  return {
    code: options.code,
    detail: options.detail,
    ...(options.errors ? { errors: options.errors } : {}),
    instance: c.req.path,
    requestId: c.get("requestId"),
    status: options.status,
    title: options.title,
    type: "about:blank",
  };
}

export const validationHook: NonNullable<OpenAPIHonoOptions<AppEnv>["defaultHook"]> = (
  result,
  c,
) => {
  if (result.success) return;

  return problemResponse(c, {
    code: "validation_failed",
    detail: "One or more request values are invalid.",
    errors: result.error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join("."),
    })),
    status: 422,
    title: "Validation failed",
  });
};
