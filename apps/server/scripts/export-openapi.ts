import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createApp } from "../src/app";

const outputPath = fileURLToPath(new URL("../openapi.json", import.meta.url));

const app = createApp({
  authHandler: () => new Response(null, { status: 404 }),
  checkReadiness: async () => {},
  corsOrigin: "http://localhost:3001",
  getSession: async () => null,
});
const response = await app.request("/openapi.json");

if (!response.ok) {
  throw new Error(`OpenAPI export failed with status ${response.status}.`);
}

const document = await response.json();
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
