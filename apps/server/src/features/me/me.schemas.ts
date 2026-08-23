import { z } from "@hono/zod-openapi";

export const CurrentUserSchema = z
  .object({
    email: z.email(),
    emailVerified: z.boolean(),
    id: z.string(),
    image: z.string().nullable(),
    name: z.string(),
  })
  .openapi("CurrentUser");
