import { createRoute } from "@hono/zod-openapi";
import jsonContent from "stoker/openapi/helpers/json-content";
import * as HttpStatusCodes from "stoker/http-status-codes";

import { ProblemDetailsSchema } from "@/http/errors/problem";
import { CurrentUserSchema } from "./me.schemas";

export const meRoute = createRoute({
  description: "Return the signed-in Taskome user.",
  method: "get",
  operationId: "getCurrentUser",
  path: "/me",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(CurrentUserSchema, "Current user"),
    [HttpStatusCodes.UNAUTHORIZED]: {
      content: {
        "application/problem+json": { schema: ProblemDetailsSchema },
      },
      description: "The request has no valid session",
    },
  },
  security: [{ cookieAuth: [] }, { apiKeyBearer: [] }],
  tags: ["Users"],
});

export type MeRoute = typeof meRoute;
