import path from "node:path";
import { createOpenAPI } from "fumadocs-openapi/server";

export const openapi = createOpenAPI({
  input: {
    "openapi.public.json": path.join(process.cwd(), "public/openapi.json"),
  },
});
