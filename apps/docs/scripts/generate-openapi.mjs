import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(docsRoot, "public/openapi.json");
const output = path.join(docsRoot, "generated/api");
const api = createOpenAPI({ input: { "openapi.public.json": schemaPath } });

await rm(output, { force: true, recursive: true });

await generateFiles({
  input: api,
  output,
  per: "tag",
  meta: true,
  includeDescription: true,
});
